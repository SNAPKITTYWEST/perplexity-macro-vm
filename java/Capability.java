package vm;

// Capability bridge — WASM imports provided by browser runtime (js/wasm bridge)
// TeaVM: @JSBody / @Import, CheerpJ: JS interop via CheerpJ.addJavaLibrary
public final class Capability {
    // Typed capability request — browser validates, then routes to local impl OR Swift gateway
    public static native String request(String capability, String jsonArgs);
    public static native String fileRead(String path);
    public static native void fileWrite(String path, String content);
    public static native String clockNow(); // ISO8601
    public static native String randomBytes(int n); // hex
    private Capability(){}
}
