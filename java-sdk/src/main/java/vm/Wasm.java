package vm;

/**
 * WASM memory introspection bridge.
 * Browser provides these via WASM imports (TeaVM @JSBody or CheerpJ JS interop).
 */
public final class Wasm {
    private Wasm() {}

    /** Returns current WASM memory size in 64KB pages. */
    public static native int memorySize();

    /** Returns heap base address. */
    public static native int heapBase();

    /** Returns stack pointer. */
    public static native int stackPointer();

    /** Grow WASM memory by {@code pages} (64KB each). Returns previous size. */
    public static native int memoryGrow(int pages);
}
