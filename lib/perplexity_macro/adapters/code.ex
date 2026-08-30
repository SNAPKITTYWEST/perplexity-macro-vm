defmodule PerplexityMacro.Adapters.Code do
  @moduledoc "Code sandbox adapter."
  def run(code, _opts \\ []), do: {:ok, [%{title: "code", url: "code://", content: code, score: 1.0, source_hash: :erlang.phash2(code,0xFFFFFFFF)}]}
end

