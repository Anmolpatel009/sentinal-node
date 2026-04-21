#include <linux/bpf.h>
#include <linux/if_ether.h>
#include <bpf/bpf_helpers.h>

struct {
    __uint(type, BPF_MAP_TYPE_ARRAY);
    __uint(max_entries, 256);
    __type(key, __u32);
    __type(value, __u64);
} global_stats SEC(".maps");

SEC("xdp")
int sentinel_pulse(struct xdp_md *ctx) {
    void *data_end = (void *)(long)ctx->data_end;
    void *data = (void *)(long)ctx->data;

    // Increment Total (Key 0)
    __u32 total_key = 0;
    __u64 *total_cnt = bpf_map_lookup_elem(&global_stats, &total_key);
    if (total_cnt) __sync_fetch_and_add(total_cnt, 1);

    unsigned char *ptr = data;
    __u32 proto_key = 0;

    // The Hunter Logic: Look for IPv4 (0x45)
    if ((void *)(ptr + 14 + 20) <= data_end) {
        if (ptr[14] == 0x45) { 
            proto_key = ptr[23]; // Protocol byte
        } else if ((void *)(ptr + 18 + 20) <= data_end && ptr[18] == 0x45) {
            proto_key = ptr[27]; // VLAN Protocol byte
        }
    }

    if (proto_key > 0) {
        __u64 *proto_cnt = bpf_map_lookup_elem(&global_stats, &proto_key);
        if (proto_cnt) __sync_fetch_and_add(proto_cnt, 1);
    }

    return XDP_PASS;
}

char _license[] SEC("license") = "GPL";