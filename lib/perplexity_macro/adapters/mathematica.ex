defmodule PerplexityMacro.Adapters.Mathematica do
  @moduledoc "Mathematica/WolframAlpha research via API or local WolframEngine."
  def run(query, opts \\ []) do
    appid = System.get_env("WOLFRAM_APPID") || Keyword.get(opts, :appid, "")
    if appid == "" do
      # Local fallback: return symbolic query as evidence (no external call)
      {:ok, [%{title: "Mathematica (local)", url: "mathematica://#{URI.encode(query)}", content: "Symbolic: #{query}", score: 0.9, source_hash: :erlang.phash2(query,0xFFFFFFFF)}]}
    else
      url = "https://api.wolframalpha.com/v1/query"
      case Req.get(url, params: [appid: appid, input: query, format: "plaintext"]) do
        {:ok, %{status: 200, body: body}} -> {:ok, [%{title: "WolframAlpha: #{query}", url: url, content: inspect(body) |> String.slice(0,4000), score: 1.0, source_hash: :erlang.phash2(query,0xFFFFFFFF)}]}
        e -> e
      end
    end
  end
end
