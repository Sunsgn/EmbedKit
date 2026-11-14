#include <stdint.h>
#include <stdio.h>

static uint16_t saturating_add_u16(uint16_t left, uint16_t right)
{
    uint32_t total = (uint32_t)left + (uint32_t)right;
    return total > UINT16_MAX ? UINT16_MAX : (uint16_t)total;
}

int main(void)
{
    const uint16_t result = saturating_add_u16(65000U, 1000U);
    if (result != UINT16_MAX) {
        return 1;
    }
    printf("synthetic firmware check: %u\n", (unsigned)result);
    return 0;
}
