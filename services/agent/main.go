package main

import (
	"encoding/json"
	"fmt"
	"log"
	"net"
	"net/http"
	"sync"
	"time"

	"github.com/cilium/ebpf/link"
	"github.com/cilium/ebpf/rlimit"
	"github.com/gorilla/websocket"
)
//go:generate go run github.com/cilium/ebpf/cmd/bpf2go sentinel bpf/sentinel.bpf.c

var upgrader = websocket.Upgrader{
	CheckOrigin: func(r *http.Request) bool { return true },
}

type Hub struct {
	clients    map[*websocket.Conn]bool
	broadcast  chan []byte
	register   chan *websocket.Conn
	unregister chan *websocket.Conn
	mu         sync.Mutex
}

func newHub() *Hub {
	return &Hub{
		clients:    make(map[*websocket.Conn]bool),
		broadcast:  make(chan []byte),
		register:   make(chan *websocket.Conn),
		unregister: make(chan *websocket.Conn),
	}
}

func (h *Hub) run() {
	for {
		select {
		case client := <-h.register:
			h.mu.Lock()
			h.clients[client] = true
			h.mu.Unlock()
			log.Println("New dashboard connection")
		case client := <-h.unregister:
			h.mu.Lock()
			if _, ok := h.clients[client]; ok {
				delete(h.clients, client)
				client.Close()
			}
			h.mu.Unlock()
		case message := <-h.broadcast:
			h.mu.Lock()
			for client := range h.clients {
				_ = client.WriteMessage(websocket.TextMessage, message)
			}
			h.mu.Unlock()
		}
	}
}

func main() {
	// 1. Remove memory lock for eBPF
	if err := rlimit.RemoveMemlock(); err != nil {
		log.Fatal("Memlock error:", err)
	}

	// 2. Load generated eBPF objects
	objs := sentinelObjects{}
	if err := loadSentinelObjects(&objs, nil); err != nil {
		log.Fatalf("Loading objects: %v", err)
	}
	defer objs.Close()

	// 3. Interface Lookup (Verify this is correct via 'ip addr')
	ifaceName := "eth0"
	iface, err := net.InterfaceByName(ifaceName)
	if err != nil {
		log.Fatalf("Interface %s not found: %v", ifaceName, err)
	}

	// 4. Attach XDP Program
	l, err := link.AttachXDP(link.XDPOptions{
		Program:   objs.SentinelPulse,
		Interface: iface.Index,
		Flags:     link.XDPGenericMode,
	})
	if err != nil {
		log.Fatalf("XDP Attach failed: %v", err)
	}
	defer l.Close()

	hub := newHub()
	go hub.run()

	http.HandleFunc("/ws", func(w http.ResponseWriter, r *http.Request) {
		conn, err := upgrader.Upgrade(w, r, nil)
		if err != nil {
			return
		}
		hub.register <- conn
	})

	// 5. THE DISSECTOR POLLING LOOP
	go func() {
		ticker := time.NewTicker(1 * time.Second)
		defer ticker.Stop()

		// Key mapping (0:Total, 1:ICMP, 6:TCP, 17:UDP)
		targets := []struct {
			label string
			key   uint32
		}{
			{"total", 0},
			{"tcp", 6},
			{"udp", 17},
			{"icmp", 1},
		}

		for range ticker.C {
			metrics := make(map[string]uint64)
			terminalOutput := "📊 [KERNEL] "

			for _, t := range targets {
				var val uint64
				k := t.key
				
				// Using GlobalStats to match 'global_stats' in C
				if err := objs.GlobalStats.Lookup(&k, &val); err != nil {
					metrics[t.label] = 0
					terminalOutput += fmt.Sprintf("%s: ERR | ", t.label)
				} else {
					metrics[t.label] = val
					terminalOutput += fmt.Sprintf("%s: %d | ", t.label, val)
				}
			}

			log.Println(terminalOutput)

			// Broadcast to Web Dashboard
			payload, _ := json.Marshal(map[string]interface{}{
				"phase":   2,
				"metrics": metrics,
				"status":  "active",
			})
			hub.broadcast <- payload
		}
	}()

	log.Printf("Sentinel Agent active on :8080. Observing %s...", ifaceName)
	if err := http.ListenAndServe(":8080", nil); err != nil {
		log.Fatal(err)
	}
}