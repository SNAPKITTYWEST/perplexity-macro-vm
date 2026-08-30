defmodule PerplexityMacro.Adapters.Browser do
  @moduledoc "Browser adapter — Playwright automation."
  def run(url, _opts \\ []), do: {:ok, [%{title: "browser: #{url}", url: url, content: "browser #{url}", score: 1.0, source_hash: :erlang.phash2(url,0xFFFFFFFF)}]}
end

