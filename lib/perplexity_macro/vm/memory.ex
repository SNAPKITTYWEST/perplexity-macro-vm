defmodule PerplexityMacro.Memory do
  def fetch_word(vm, addr), do: Map.get(vm.ram, addr, Map.get(vm.rom, addr, 0))
end
