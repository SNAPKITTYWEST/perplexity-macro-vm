defmodule PerplexityMacro.VM.State do
  @enforce_keys [:rom]
  defstruct rom: %{}, ram: %{}, regs: %{a: 0, b: 0, c: 0, d: 0, pc: 0, sp: 0xDFFF, bp: 0, flags: 0}, cycles: 0, retired: 0, halted?: false, waiting?: false, waiting_request: nil, fuel: 128, transcript_hash: 0, breakpoints: MapSet.new(), watches: MapSet.new(), trace_seq: 0
end

