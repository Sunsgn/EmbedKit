# Capability boundaries

- Host GCC evidence proves only compilation and execution of the isolated synthetic host fixture. It is not MCU, RTOS, timing, memory-map, or device evidence.
- KiCad/AD19 results require an installed, version-probed tool and native editable design. Absence is `UNAVAILABLE`; no generated image or mock DRC can substitute.
- IAR/Keil build claims require the actual licensed tool and target project. Their absence is not PASS.
- HIL, flashing, serial hardware control, fabrication ordering, production release, and safety approval need target identity, authorization, real execution, and raw evidence.
- The in-process controlled executor validates its own actions. Since the host exposes other write mechanisms, isolation is `POLICY_ONLY`, not mandatory OS-level mediation.
- V5.1.4 migration rows marked `MERGED_SEED` preserve traceability but remain review items until each detailed semantic rule has dedicated V6 implementation and test evidence.
