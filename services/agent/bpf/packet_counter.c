#include <linux/bpf.h>
#include "bpf_helpers.h" // Local include

/* The bridge between Kernel and User-space */
struct {
    __uint(type, BPF_MAP_TYPE_ARRAY);
    __uint(max_entries, 256); // Increased to accommodate protocol numbers
    __type(key, __u32);
    __type(value, __u64);
} pkt_stats SEC(".maps");

SEC("xdp")
int sentinel_pulse(struct xdp_md *ctx) {
    void *data_end = (void *)(long)ctx->data_end;
    void *data = (void *)(long)ctx->data;

    // 1. Parse Ethernet Header
    struct ethhdr *eth = data;
    if ((void *)(eth + 1) > data_end)
        return XDP_PASS;

    // Only look at IPv4 traffic
    if (eth->h_proto != bpf_htons(ETH_P_IP))
        return XDP_PASS;

    // 2. Parse IP Header
    struct iphdr *ip = data + sizeof(struct ethhdr);
    if ((void *)(ip + 1) > data_end)
        return XDP_PASS;

    // 3. Extract Protocol and Update Map
    __u32 proto = ip->protocol;
    __u64 *count;

    count = bpf_map_lookup_elem(&pkt_stats, &proto);
    if (count) {
        __sync_fetch_and_add(count, 1);
    }

    // Also update a "Total" counter at index 0 for convenience
    __u32 total_key = 0;
    __u64 *total_count = bpf_map_lookup_elem(&pkt_stats, &total_key);
    if (total_count) {
        __sync_fetch_and_add(total_count, 1);
    }

    return XDP_PASS;
}
char _license[] SEC("license") = "GPL";