import { trpc } from "@/lib/trpc";
import { useRoute, useLocation } from "wouter";
import { ArrowLeft, Copy, CheckCircle, ExternalLink, ChevronDown, ChevronRight, Loader2, Play, FileText, Eye, PenTool, ListChecks } from "lucide-react";
import { useState, useMemo } from "react";
import { toast } from "sonner";

export default function Results() {
  const [, params] = useRoute("/results/:id");
  const [, setLocation] = useLocation();
  const id = Number(params?.id);

  const { data: run, isLoading } = trpc.pipeline.get.useQuery(
    { id },
    { refetchInterval: (query) => {
      const d = query.state.data;
      return d && (d.status === "running" || d.status === "pending") ? 3000 : false;
    }}
  );

  if (isLoading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 text-emerald-400 animate-spin" />
      </div>
    );
  }

  if (!run) {
    return (
      <div className="p-6">
        <p className="text-gray-400">Pipeline run not found.</p>
      </div>
    );
  }

  const scripts = (run.scriptsJson as any[]) || [];
  const clickupTasks = (run.clickupTasksJson as any[]) || [];
  const isRunning = run.status === "running" || run.status === "pending";

  return (
    <div className="p-6 max-w-6xl">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <button onClick={() => setLocation("/")} className="text-gray-400 hover:text-white flex items-center gap-1 text-sm">
          <ArrowLeft className="w-4 h-4" /> Back
        </button>
        <div className="flex-1">
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            {run.foreplayAdTitle ? (
              <><CheckCircle className="w-5 h-5 text-emerald-400" /> {run.foreplayAdTitle}</>
            ) : (
              `Pipeline Run #${run.id}`
            )}
          </h1>
          <p className="text-gray-500 text-sm">
            {run.foreplayAdBrand || ""} · {run.product} · {run.triggerSource === "manual" ? "Manual trigger" : run.triggerSource}
          </p>
        </div>
        {isRunning && (
          <div className="flex items-center gap-2 text-orange-400 text-sm">
            <Loader2 className="w-4 h-4 animate-spin" /> Pipeline running...
          </div>
        )}
      </div>

      {/* Running Status */}
      {isRunning && (
        <div className="bg-[#191B1F] border border-orange-500/20 rounded-xl p-6 mb-6">
          <div className="flex items-center gap-3 mb-3">
            <Loader2 className="w-5 h-5 text-orange-400 animate-spin" />
            <span className="text-white font-medium">Pipeline in progress...</span>
          </div>
          <div className="space-y-2 text-sm text-gray-400">
            <StepStatus label="Foreplay Pull" done={!!run.foreplayAdId} />
            <StepStatus label="Transcription" done={!!run.transcript} />
            <StepStatus label="Visual Analysis" done={!!run.visualAnalysis} />
            <StepStatus label="Script Generation & Expert Review" done={scripts.length > 0} />
            <StepStatus label="ClickUp Task Creation" done={clickupTasks.length > 0} />
          </div>
        </div>
      )}

      {/* Error */}
      {run.status === "failed" && run.errorMessage && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 mb-6 text-red-400 text-sm">
          {run.errorMessage}
        </div>
      )}

      {/* Static pipeline results */}
      {run.pipelineType === "static" && (
        <StaticResults run={run} />
      )}

      {/* Video pipeline results */}
      {run.pipelineType === "video" && (
        <>
          {/* Section 1 & 2: Original Creative + Transcript side by side */}
          {(run.videoUrl || run.transcript) && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
              {/* Original Creative */}
              <div className="bg-[#191B1F] border border-white/5 rounded-xl p-5">
                <h2 className="text-white font-semibold mb-4 flex items-center gap-2">
                  <Play className="w-4 h-4 text-emerald-400" /> Original Creative
                </h2>
                {run.videoUrl ? (
                  <div className="rounded-lg overflow-hidden bg-black mb-3">
                    <video
                      src={run.videoUrl}
                      controls
                      className="w-full"
                      poster={run.thumbnailUrl || undefined}
                    />
                  </div>
                ) : run.thumbnailUrl ? (
                  <img src={run.thumbnailUrl} alt="Thumbnail" className="w-full rounded-lg mb-3" />
                ) : null}
                <div className="flex items-center gap-3 text-xs text-gray-400">
                  <span className="bg-white/5 px-2 py-1 rounded">{run.product}</span>
                  <span className="bg-white/5 px-2 py-1 rounded">{run.priority}</span>
                  <span>{new Date(run.createdAt).toLocaleString()}</span>
                </div>
              </div>

              {/* Transcript */}
              {run.transcript && (
                <div className="bg-[#191B1F] border border-white/5 rounded-xl p-5">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-white font-semibold flex items-center gap-2">
                      <FileText className="w-4 h-4 text-blue-400" /> Transcript
                    </h2>
                    <button
                      onClick={() => { navigator.clipboard.writeText(run.transcript || ""); toast.success("Copied!"); }}
                      className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-white px-2 py-1 rounded hover:bg-white/5"
                    >
                      <Copy className="w-3.5 h-3.5" /> Copy
                    </button>
                  </div>
                  <div className="text-gray-300 text-sm leading-relaxed max-h-80 overflow-y-auto pr-2">
                    {run.transcript}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Section 3: Visual Analysis */}
          {run.visualAnalysis && (
            <div className="bg-[#191B1F] border border-white/5 rounded-xl p-5 mb-6">
              <h2 className="text-white font-semibold mb-4 flex items-center gap-2">
                <Eye className="w-4 h-4 text-emerald-400" /> Visual Analysis
              </h2>
              <div className="text-gray-300 text-sm leading-relaxed whitespace-pre-wrap">
                <MarkdownContent content={run.visualAnalysis} />
              </div>
            </div>
          )}

          {/* Section 4: Generated Scripts */}
          {scripts.length > 0 && <ScriptsSection scripts={scripts} />}

          {/* Section 5: ClickUp Tasks */}
          {clickupTasks.length > 0 && (
            <div className="bg-[#191B1F] border border-white/5 rounded-xl p-5 mt-6">
              <h2 className="text-white font-semibold mb-4 flex items-center gap-2">
                <ListChecks className="w-4 h-4 text-emerald-400" /> ClickUp Tasks Created ({clickupTasks.length})
              </h2>
              <div className="space-y-2">
                {clickupTasks.map((task: any, i: number) => (
                  <div key={i} className="flex items-center justify-between bg-[#01040A] rounded-lg px-4 py-3 border border-white/5">
                    <div className="flex items-center gap-3">
                      <CheckCircle className="w-4 h-4 text-emerald-400" />
                      <span className="text-white text-sm">{task.name}</span>
                      {scripts[i]?.review?.finalScore && (
                        <span className="text-xs bg-orange-500/20 text-orange-400 px-2 py-0.5 rounded">
                          Score: {scripts[i].review.finalScore}
                        </span>
                      )}
                    </div>
                    {task.url && task.url !== "#" && (
                      <a href={task.url} target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-white">
                        <ExternalLink className="w-4 h-4" />
                      </a>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function StepStatus({ label, done }: { label: string; done: boolean }) {
  return (
    <div className="flex items-center gap-2">
      {done ? <CheckCircle className="w-4 h-4 text-emerald-400" /> : <div className="w-4 h-4 rounded-full border border-gray-600" />}
      <span className={done ? "text-emerald-400" : "text-gray-500"}>{label}</span>
    </div>
  );
}

function ScriptsSection({ scripts }: { scripts: any[] }) {
  const [activeTab, setActiveTab] = useState(0);
  const script = scripts[activeTab];

  return (
    <div className="bg-[#191B1F] border border-white/5 rounded-xl overflow-hidden mt-6">
      {/* Header */}
      <div className="px-5 pt-5 pb-0">
        <div className="flex items-center gap-3 mb-4">
          <h2 className="text-white font-semibold flex items-center gap-2">
            <PenTool className="w-4 h-4 text-emerald-400" /> Generated Scripts ({scripts.length})
          </h2>
          <span className="text-xs bg-emerald-600 text-white px-2 py-0.5 rounded font-medium">Expert Reviewed</span>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-white/5">
          {scripts.map((s: any, i: number) => (
            <button
              key={i}
              onClick={() => setActiveTab(i)}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                activeTab === i
                  ? "border-emerald-500 text-white"
                  : "border-transparent text-gray-500 hover:text-gray-300"
              }`}
            >
              {s.label}
              {s.review?.finalScore && (
                <span className={`ml-2 text-xs ${activeTab === i ? "text-orange-400" : "text-gray-600"}`}>
                  {s.review.finalScore}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Script Content */}
      {script && (
        <div className="p-5">
          {/* Title */}
          <div className="mb-4">
            <h3 className="text-lg font-semibold text-white">
              {script.title}
              <span className="ml-2 text-xs bg-blue-500/20 text-blue-400 px-2 py-0.5 rounded">{script.type}</span>
              {script.review?.finalScore && (
                <span className="ml-2 text-xs bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded">
                  Score: {script.review.finalScore}/100
                </span>
              )}
            </h3>
          </div>

          {/* Expert Review Panel */}
          {script.review && <ExpertReviewPanel review={script.review} />}

          {/* Summary */}
          {script.review?.summary && (
            <div className="text-gray-300 text-sm italic leading-relaxed mb-6 bg-[#01040A] rounded-lg p-4 border border-white/5">
              {script.review.summary}
            </div>
          )}

          {/* HOOK */}
          <div className="mb-6">
            <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2 bg-[#01040A] inline-block px-2 py-1 rounded">HOOK</div>
            <p className="text-white text-base">{script.hook}</p>
          </div>

          {/* FULL SCRIPT Table */}
          {script.script && Array.isArray(script.script) && script.script.length > 0 && (
            <div className="mb-6">
              <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">FULL SCRIPT</div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-white/10">
                      <th className="text-left text-gray-400 font-medium py-2 pr-4 w-24">TIMESTAMP</th>
                      <th className="text-left text-gray-400 font-medium py-2 pr-4">VISUAL</th>
                      <th className="text-left text-gray-400 font-medium py-2">DIALOGUE</th>
                    </tr>
                  </thead>
                  <tbody>
                    {script.script.map((row: any, i: number) => (
                      <tr key={i} className="border-b border-white/5">
                        <td className="py-3 pr-4 text-orange-400 font-medium align-top whitespace-nowrap">{row.timestamp}</td>
                        <td className="py-3 pr-4 text-gray-300 align-top">{row.visual}</td>
                        <td className="py-3 text-gray-300 align-top">{row.dialogue}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* VISUAL DIRECTION */}
          {script.visualDirection && (
            <div className="mb-6">
              <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">VISUAL DIRECTION</div>
              <div className="text-gray-300 text-sm leading-relaxed bg-[#01040A] rounded-lg p-4 border border-white/5">
                {script.visualDirection}
              </div>
            </div>
          )}

          {/* STRATEGIC THESIS */}
          {script.strategicThesis && (
            <div className="mb-6">
              <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">STRATEGIC THESIS</div>
              <div className="text-gray-300 text-sm leading-relaxed bg-[#01040A] rounded-lg p-4 border border-white/5">
                {script.strategicThesis}
              </div>
            </div>
          )}

          {/* Copy Full Script */}
          <button
            onClick={() => {
              const text = formatScriptText(script);
              navigator.clipboard.writeText(text);
              toast.success("Script copied!");
            }}
            className="flex items-center gap-2 text-sm text-gray-400 hover:text-white px-3 py-2 rounded-lg hover:bg-white/5 border border-white/5"
          >
            <Copy className="w-4 h-4" /> Copy Full Script
          </button>
        </div>
      )}
    </div>
  );
}

function ExpertReviewPanel({ review }: { review: any }) {
  const [expandedRound, setExpandedRound] = useState<number | null>(
    review.rounds?.length ? review.rounds.length - 1 : null
  );
  const [expandedExperts, setExpandedExperts] = useState<Set<number>>(new Set());

  const toggleExpert = (i: number) => {
    setExpandedExperts(prev => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });
  };

  return (
    <div className="bg-[#01040A] border border-white/5 rounded-xl p-5 mb-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-emerald-600/20 flex items-center justify-center">
            <CheckCircle className="w-5 h-5 text-emerald-400" />
          </div>
          <div>
            <div className="text-white font-semibold">Expert Review Panel</div>
            <div className="text-gray-500 text-xs">{review.rounds?.length || 0} rounds of review</div>
          </div>
        </div>
        <div className="text-right">
          <div className="text-2xl font-bold text-orange-400">
            <span className="text-yellow-400">★</span> {review.finalScore}<span className="text-sm text-gray-400">/100</span>
          </div>
          {review.approved && (
            <span className="text-xs bg-emerald-600 text-white px-2 py-0.5 rounded">Approved</span>
          )}
        </div>
      </div>

      {/* Round progression */}
      {review.rounds && review.rounds.length > 1 && (
        <div className="flex items-center gap-2 mb-4 text-sm">
          <span className="text-gray-500">↗</span>
          {review.rounds.map((r: any, i: number) => (
            <span key={i} className="flex items-center gap-1">
              <span className={`px-2 py-0.5 rounded text-xs ${
                i === review.rounds.length - 1 ? "bg-emerald-600 text-white" : "bg-white/5 text-gray-400"
              }`}>
                R{r.roundNumber}: {r.averageScore}
              </span>
              {i < review.rounds.length - 1 && <span className="text-gray-600">→</span>}
            </span>
          ))}
        </div>
      )}

      {/* Rounds */}
      {review.rounds?.map((round: any, ri: number) => (
        <div key={ri} className="mb-3">
          <button
            onClick={() => setExpandedRound(expandedRound === ri ? null : ri)}
            className="w-full flex items-center justify-between py-2 text-sm"
          >
            <div className="flex items-center gap-2">
              {expandedRound === ri ? <ChevronDown className="w-4 h-4 text-gray-400" /> : <ChevronRight className="w-4 h-4 text-gray-400" />}
              <span className="text-white font-medium">Round {round.roundNumber}</span>
              <span className="text-gray-400">Avg: {round.averageScore}/100</span>
              {ri === review.rounds.length - 1 && (
                <span className="text-xs bg-emerald-600 text-white px-1.5 py-0.5 rounded">Final</span>
              )}
            </div>
            <div className="flex items-center gap-1">
              {round.expertReviews?.slice(0, 5).map((_: any, ei: number) => (
                <div key={ei} className="w-2 h-2 rounded-full bg-emerald-500" />
              ))}
              {round.expertReviews?.length > 5 && (
                <span className="text-xs text-gray-500">+{round.expertReviews.length - 5}</span>
              )}
            </div>
          </button>

          {expandedRound === ri && round.expertReviews && (
            <div className="ml-6 mt-2 space-y-1">
              {/* Bar chart */}
              <div className="mb-4 space-y-1.5">
                {round.expertReviews.map((er: any, ei: number) => (
                  <div key={ei} className="flex items-center gap-3">
                    <span className="text-xs text-gray-500 w-4 text-right">{ei + 1}</span>
                    <div className="flex-1 h-5 bg-[#191B1F] rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-emerald-600 to-emerald-400"
                        style={{ width: `${er.score}%` }}
                      />
                    </div>
                    <span className="text-xs text-orange-400 font-medium w-8 text-right">{er.score}</span>
                  </div>
                ))}
              </div>

              {/* Expert details */}
              {round.expertReviews.map((er: any, ei: number) => (
                <div key={ei} className="border-b border-white/5 last:border-0">
                  <button
                    onClick={() => toggleExpert(ri * 100 + ei)}
                    className="w-full flex items-center justify-between py-2.5 text-sm"
                  >
                    <div className="flex items-center gap-2">
                      {expandedExperts.has(ri * 100 + ei) ? <ChevronDown className="w-3.5 h-3.5 text-gray-500" /> : <ChevronRight className="w-3.5 h-3.5 text-gray-500" />}
                      <span className="text-white font-medium">{er.expertName}</span>
                      <span className="text-gray-500">— {er.domain}</span>
                    </div>
                    <span className="text-orange-400 font-medium">{er.score}/100</span>
                  </button>
                  {expandedExperts.has(ri * 100 + ei) && (
                    <div className="ml-6 pb-3 text-sm text-gray-400">
                      {er.feedback}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function StaticResults({ run }: { run: any }) {
  const images = (run.staticAdImages as any[]) || [];
  return (
    <div className="space-y-6">
      {images.length > 0 && (
        <div className="bg-[#191B1F] border border-white/5 rounded-xl p-5">
          <h2 className="text-white font-semibold mb-4">Selected Reference Ads</h2>
          <div className="grid grid-cols-3 gap-3">
            {images.map((img: any, i: number) => (
              <div key={i} className="rounded-lg overflow-hidden bg-[#01040A]">
                {img.imageUrl && <img src={img.imageUrl} alt={img.title || "Ad"} className="w-full aspect-square object-cover" />}
                <div className="p-2">
                  <p className="text-white text-xs truncate">{img.title || "Untitled"}</p>
                  <p className="text-gray-500 text-xs">{img.brandName}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      {run.staticAnalysis && (
        <div className="bg-[#191B1F] border border-white/5 rounded-xl p-5">
          <h2 className="text-white font-semibold mb-4 flex items-center gap-2">
            <Eye className="w-4 h-4 text-emerald-400" /> Static Ad Analysis
          </h2>
          <div className="text-gray-300 text-sm leading-relaxed whitespace-pre-wrap">
            <MarkdownContent content={run.staticAnalysis} />
          </div>
        </div>
      )}
      {run.generatedImageUrl && (
        <div className="bg-[#191B1F] border border-white/5 rounded-xl p-5">
          <h2 className="text-white font-semibold mb-4">Generated ONEST Creative</h2>
          <img src={run.generatedImageUrl} alt="Generated creative" className="w-full max-w-lg rounded-lg" />
        </div>
      )}
    </div>
  );
}

function MarkdownContent({ content }: { content: string }) {
  // Simple markdown-like rendering for bold, headers, bullets
  const lines = content.split("\n");
  return (
    <div className="space-y-1">
      {lines.map((line, i) => {
        if (line.startsWith("**") && line.endsWith("**")) {
          return <p key={i} className="font-semibold text-white mt-3">{line.replace(/\*\*/g, "")}</p>;
        }
        if (line.startsWith("---")) {
          return <hr key={i} className="border-white/10 my-3" />;
        }
        if (line.startsWith("* ") || line.startsWith("- ")) {
          const text = line.slice(2);
          return (
            <p key={i} className="pl-4 relative">
              <span className="absolute left-0">•</span>
              <InlineBold text={text} />
            </p>
          );
        }
        if (line.startsWith("  * ") || line.startsWith("  - ")) {
          const text = line.slice(4);
          return (
            <p key={i} className="pl-8 relative">
              <span className="absolute left-4">•</span>
              <InlineBold text={text} />
            </p>
          );
        }
        if (line.trim() === "") return <div key={i} className="h-2" />;
        return <p key={i}><InlineBold text={line} /></p>;
      })}
    </div>
  );
}

function InlineBold({ text }: { text: string }) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return (
    <>
      {parts.map((part, i) => {
        if (part.startsWith("**") && part.endsWith("**")) {
          return <strong key={i} className="text-white font-semibold">{part.slice(2, -2)}</strong>;
        }
        return <span key={i}>{part}</span>;
      })}
    </>
  );
}

function formatScriptText(script: any): string {
  let text = `${script.title}\n\nHOOK: ${script.hook}\n\nFULL SCRIPT:\n`;
  if (script.script && Array.isArray(script.script)) {
    for (const row of script.script) {
      text += `\n[${row.timestamp}]\nVISUAL: ${row.visual}\nDIALOGUE: ${row.dialogue}\n`;
    }
  }
  text += `\nVISUAL DIRECTION:\n${script.visualDirection}\n\nSTRATEGIC THESIS:\n${script.strategicThesis}`;
  return text;
}
