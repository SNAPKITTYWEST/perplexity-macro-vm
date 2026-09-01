package vm;

import org.junit.Test;
import static org.junit.Assert.*;

public class MainTest {
    @Test
    public void testExecuteReturnsResult() {
        String result = Main.execute("int x = 2 + 2;");
        assertNotNull(result);
        assertTrue(result.contains("executed"));
        assertTrue(result.contains("4 chars"));
    }

    @Test
    public void testCapabilityRequest() {
        // Capability.request is native (WASM import) — in unit tests it throws
        // This test verifies the class loads and the method signature is correct
        try {
            Capability.request("search", "{\"query\":\"test\"}");
            fail("Should throw UnsatisfiedLinkError in unit test (native WASM import)");
        } catch (UnsatisfiedLinkError e) {
            // Expected — native methods only work in WASM runtime
            assertTrue(e.getMessage().contains("vm"));
        }
    }

    @Test
    public void testWasmClassLoads() {
        // Wasm.memorySize is native — verify class loads
        try {
            Wasm.memorySize();
            fail("Should throw UnsatisfiedLinkError in unit test");
        } catch (UnsatisfiedLinkError e) {
            assertTrue(e.getMessage().contains("vm"));
        }
    }
}
