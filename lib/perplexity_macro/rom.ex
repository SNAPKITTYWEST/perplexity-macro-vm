defmodule PerplexityMacro.ROM do
  @moduledoc "Binds zero-page mailbox registers to Elixir handlers."
  use GenServer
  defstruct [:emulator_pid, :bridge_mode, :memory_map]
  def start_link(opts), do: GenServer.start_link(__MODULE__, opts, name: __MODULE__)
  @impl true
  def init(opts) do
    state = %__MODULE__{emulator_pid: Keyword.get(opts, :emulator_pid), bridge_mode: :file_mapped, memory_map: :ets.new(:rom_mailbox, [:public, :set])}
    {:ok, state}
  end
  @impl true
  def handle_call({:read_mailbox}, _from, state) do
    status = read_byte(state, 0x03)
    reply = case status do
      0x01 -> {:request, decode_capability(read_byte(state, 0x02)), read_query(state), read_nonce(state)}
      _ -> :idle
    end
    {:reply, reply, state}
  end
  @impl true
  def handle_cast({:write_result, tlv_payload, crc16}, state) do
    write_bytes(state, 0x46, tlv_payload)
    write_word(state, 0xC6, crc16)
    write_byte(state, 0x03, 0x02)
    {:noreply, state}
  end
  defp read_byte(_state, addr), do: :ets.lookup_element(:rom_mailbox, addr, 2, 0)
  defp write_byte(state, addr, val), do: :ets.insert(state.memory_map, {addr, val})
  defp write_bytes(state, start_addr, bytes) do
    bytes |> :binary.bin_to_list() |> Enum.with_index(start_addr) |> Enum.each(fn {b,a} -> write_byte(state, a, b) end)
  end
  defp write_word(state, addr, val) do
    <<lo::8, hi::8>> = <<val::16-little>>
    write_byte(state, addr, lo); write_byte(state, addr+1, hi)
  end
  defp decode_capability(1), do: :search
  defp decode_capability(2), do: :fetch
  defp decode_capability(3), do: :browse
  defp decode_capability(4), do: :code
  defp decode_capability(5), do: :model
  defp decode_capability(6), do: :wikipedia
  defp decode_capability(7), do: :mathematica
  defp decode_capability(8), do: :dictionary
  defp decode_capability(_), do: :unknown
  defp read_query(_state), do: "synthetic_research_query"
  defp read_nonce(_state), do: 0xDEAD
end
