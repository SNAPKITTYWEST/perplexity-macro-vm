defmodule PerplexityMacro.Inspector do
  def snapshot(vm), do: %{regs: vm.regs, cycles: vm.cycles, retired: vm.retired, fuel: vm.fuel}
  def memory_slice(vm, from, count), do: for(a <- from..(from+count-1), do: %{address: a, word: PerplexityMacro.Memory.fetch_word(vm,a)})
end
