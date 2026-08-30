defmodule PerplexityMacro.Adapters.LocalModel do
  @moduledoc "Local model via Ollama / LM Studio."
  def run(prompt, _opts \\ []), do: {:ok, [%{title: "local_model", url: "ollama://", content: "local_model: #{prompt}", score: 1.0, source_hash: :erlang.phash2(prompt,0xFFFFFFFF)}]}
end

