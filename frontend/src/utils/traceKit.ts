export const TRACE_KIT_HEADER = `#ifndef EMBEDKIT_TRACE_H
#define EMBEDKIT_TRACE_H

#include <stddef.h>
#include <stdint.h>

#ifndef EK_TRACE_ENABLED
#define EK_TRACE_ENABLED 1
#endif

#ifdef __cplusplus
extern "C" {
#endif

uint32_t ek_trace_port_millis(void);
void ek_trace_port_write(const char *data, size_t length);
void ek_trace_emit(const char *type, const char *name, const char *context, const char *value);

#if EK_TRACE_ENABLED
#define EK_TRACE_BOOT(name)       ek_trace_emit("boot", (name), "boot", "")
#define EK_TRACE_ENTER(context)   ek_trace_emit("enter", __func__, (context), "")
#define EK_TRACE_EXIT(context)    ek_trace_emit("exit", __func__, (context), "")
#define EK_TRACE_TASK(name)       ek_trace_emit("task", (name), (name), "")
#define EK_TRACE_ISR(name)        ek_trace_emit("interrupt", (name), "isr", "")
#define EK_TRACE_STATE(name, val) ek_trace_emit("state", (name), "state", (val))
#define EK_TRACE_EVENT(name, ctx) ek_trace_emit("event", (name), (ctx), "")
#define EK_TRACE_ERROR(name, val) ek_trace_emit("error", (name), "error", (val))
#else
#define EK_TRACE_BOOT(name)       ((void)0)
#define EK_TRACE_ENTER(context)   ((void)0)
#define EK_TRACE_EXIT(context)    ((void)0)
#define EK_TRACE_TASK(name)       ((void)0)
#define EK_TRACE_ISR(name)        ((void)0)
#define EK_TRACE_STATE(name, val) ((void)0)
#define EK_TRACE_EVENT(name, ctx) ((void)0)
#define EK_TRACE_ERROR(name, val) ((void)0)
#endif

#ifdef __cplusplus
}
#endif
#endif
`;

export const TRACE_KIT_SOURCE = `#include "embedkit_trace.h"
#include <stdio.h>

#if defined(__GNUC__)
#define EK_WEAK __attribute__((weak))
#elif defined(__ICCARM__) || defined(__CC_ARM) || defined(__ARMCC_VERSION)
#define EK_WEAK __weak
#else
#define EK_WEAK
#endif

EK_WEAK uint32_t ek_trace_port_millis(void) {
    return 0U;
}

EK_WEAK void ek_trace_port_write(const char *data, size_t length) {
    (void)data;
    (void)length;
    /* Override this function with a non-blocking UART, RTT, SWO or network writer. */
}

void ek_trace_emit(const char *type, const char *name, const char *context, const char *value) {
#if EK_TRACE_ENABLED
    char line[192];
    int length = snprintf(line, sizeof(line), "EK|%lu|%s|%s|%s|%s\\n",
        (unsigned long)ek_trace_port_millis(),
        type != NULL ? type : "event",
        name != NULL ? name : "unknown",
        context != NULL ? context : "",
        value != NULL ? value : "");
    if (length > 0) {
        size_t used = (size_t)length < sizeof(line) ? (size_t)length : sizeof(line) - 1U;
        ek_trace_port_write(line, used);
    }
#else
    (void)type; (void)name; (void)context; (void)value;
#endif
}
`;
