import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Loader2,
  Video,
  Image as ImageIcon,
  FileText,
  ChevronDown,
  ChevronRight,
  ChevronLeft,
  BookOpen,
} from "lucide-react";
import { useLocation } from "wouter";

const PILLARS = [
  "PTC Value",
  "Story",
  "Edutaining",
  "Trends",
  "Sale",
  "Motivation",
  "Life Dump",
  "Workout",
];

const FORMATS = ["Video", "Static", "Caption"];

const DATE_RANGES = [
  { value: "7", label: "Last 7 days" },
  { value: "30", label: "Last 30 days" },
  { value: "all", label: "All time" },
];

type ContentType = "all" | "organic" | "ad" | "ugc";

type ContentItem = {
  id: number;
  date: string;
  type: string;
  pillar: string;
  format: string;
  preview: string;
  outputUrl?: string;
  captions?: Record<string, string>;
  details?: Record<string, any>;
};

export default function ContentLibrary() {
  const [, setLocation] = useLocation();
  const [typeTab, setTypeTab] = useState<ContentType>("all");
  const [pillarFilter, setPillarFilter] = useState("all");
  const [formatFilter, setFormatFilter] = useState("all");
  const [dateRange, setDateRange] = useState("30");
  const [page, setPage] = useState(1);
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const perPage = 20;

  const contentQuery = trpc.organic.listContent.useQuery();

  // Client-side filtering since the server endpoint returns all content
  const rawData = contentQuery.data;
  const combined: any[] = [
    ...((rawData as any)?.adRuns || []).map((r: any) => ({ ...r, _source: "ad" })),
    ...((rawData as any)?.organicRuns || []).map((r: any) => ({ ...r, _source: "organic" })),
  ];
  const allItems: ContentItem[] = combined.map((item: any, idx: number) => ({
    id: item.id ?? idx,
    date: item.createdAt ?? item.date ?? "",
    type: item.type ?? "organic",
    pillar: item.contentPillar ?? item.pillar ?? "",
    format: item.format ?? "",
    preview: item.topic ?? item.preview ?? "",
    outputUrl: item.outputUrl,
    captions: item.captions,
    details: item.details,
  }));

  const filteredItems = allItems.filter((item) => {
    if (typeTab !== "all" && item.type !== typeTab) return false;
    if (pillarFilter !== "all" && item.pillar !== pillarFilter) return false;
    if (formatFilter !== "all" && item.format !== formatFilter) return false;
    if (dateRange !== "all") {
      const daysAgo = parseInt(dateRange);
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - daysAgo);
      if (new Date(item.date) < cutoff) return false;
    }
    return true;
  });

  const totalCount = filteredItems.length;
  const totalPages = Math.max(1, Math.ceil(totalCount / perPage));
  const items = filteredItems.slice((page - 1) * perPage, page * perPage);

  const typeTabs: { value: ContentType; label: string }[] = [
    { value: "all", label: "All" },
    { value: "organic", label: "Organic" },
    { value: "ad", label: "Ad" },
    { value: "ugc", label: "UGC" },
  ];

  const getTypeIcon = (type: string) => {
    switch (type?.toLowerCase()) {
      case "video":
        return <Video className="w-3.5 h-3.5 text-blue-400" />;
      case "static":
        return <ImageIcon className="w-3.5 h-3.5 text-purple-400" />;
      case "caption":
        return <FileText className="w-3.5 h-3.5 text-green-400" />;
      default:
        return <FileText className="w-3.5 h-3.5 text-gray-400" />;
    }
  };

  const formatDate = (dateStr: string) => {
    try {
      return new Date(dateStr).toLocaleDateString("en-AU", {
        day: "numeric",
        month: "short",
        year: "numeric",
      });
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="min-h-screen bg-[#01040A]">
      <div className="p-6">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">Content Library</h1>
          <p className="text-gray-400 text-sm">
            Browse and manage all generated content across pipelines
          </p>
        </div>

        {/* Type Tabs */}
        <div className="flex gap-1 mb-5">
          {typeTabs.map((tab) => (
            <button
              key={tab.value}
              onClick={() => {
                setTypeTab(tab.value);
                setPage(1);
              }}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                typeTab === tab.value
                  ? "bg-white/10 text-white"
                  : "text-gray-500 hover:text-gray-300 hover:bg-white/5"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Filter Bar */}
        <div className="flex items-center gap-3 mb-5">
          <Select
            value={pillarFilter}
            onValueChange={(v) => {
              setPillarFilter(v);
              setPage(1);
            }}
          >
            <SelectTrigger className="w-[160px] bg-white/5 border-white/10 text-white text-sm">
              <SelectValue placeholder="All Pillars" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Pillars</SelectItem>
              {PILLARS.map((p) => (
                <SelectItem key={p} value={p}>
                  {p}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={formatFilter}
            onValueChange={(v) => {
              setFormatFilter(v);
              setPage(1);
            }}
          >
            <SelectTrigger className="w-[140px] bg-white/5 border-white/10 text-white text-sm">
              <SelectValue placeholder="All Formats" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Formats</SelectItem>
              {FORMATS.map((f) => (
                <SelectItem key={f} value={f}>
                  {f}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={dateRange}
            onValueChange={(v) => {
              setDateRange(v);
              setPage(1);
            }}
          >
            <SelectTrigger className="w-[150px] bg-white/5 border-white/10 text-white text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {DATE_RANGES.map((d) => (
                <SelectItem key={d.value} value={d.value}>
                  {d.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <span className="text-xs text-gray-600 ml-auto">
            {totalCount} item{totalCount !== 1 ? "s" : ""}
          </span>
        </div>

        {/* Content Table */}
        <div className="bg-[#0D0F12] rounded-xl border border-white/5 overflow-hidden">
          {/* Table Header */}
          <div className="grid grid-cols-[100px_60px_120px_100px_1fr] gap-4 px-5 py-3 border-b border-white/5">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-600">
              Date
            </span>
            <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-600">
              Type
            </span>
            <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-600">
              Pillar
            </span>
            <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-600">
              Format
            </span>
            <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-600">
              Output
            </span>
          </div>

          {/* Loading */}
          {contentQuery.isLoading && (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="w-5 h-5 text-gray-600 animate-spin" />
            </div>
          )}

          {/* Empty state */}
          {!contentQuery.isLoading && items.length === 0 && (
            <div className="flex flex-col items-center justify-center py-20">
              <div className="w-14 h-14 rounded-2xl bg-white/5 flex items-center justify-center mb-4">
                <BookOpen className="w-6 h-6 text-gray-600" />
              </div>
              <p className="text-gray-500 text-sm mb-4">No content yet</p>
              <Button
                onClick={() => setLocation("/organic/video")}
                className="bg-[#FF3838] hover:bg-[#FF3838]/90 text-white text-sm"
              >
                Create Organic Video
              </Button>
            </div>
          )}

          {/* Table Rows */}
          {items.map((item) => {
            const isExpanded = expandedId === item.id;
            return (
              <div key={item.id}>
                <button
                  onClick={() => setExpandedId(isExpanded ? null : item.id)}
                  className="w-full grid grid-cols-[100px_60px_120px_100px_1fr] gap-4 px-5 py-3 border-b border-white/5 text-left hover:bg-white/[0.02] transition-colors items-center"
                >
                  <span className="text-xs text-gray-400">
                    {formatDate(item.date)}
                  </span>
                  <span className="flex items-center">
                    {getTypeIcon(item.format)}
                  </span>
                  <span className="text-xs text-gray-300">{item.pillar || "-"}</span>
                  <span className="text-xs text-gray-400">{item.format || "-"}</span>
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-xs text-gray-500 truncate flex-1">
                      {item.preview || "-"}
                    </span>
                    {isExpanded ? (
                      <ChevronDown className="w-3.5 h-3.5 text-gray-600 shrink-0" />
                    ) : (
                      <ChevronRight className="w-3.5 h-3.5 text-gray-600 shrink-0" />
                    )}
                  </div>
                </button>

                {/* Expanded Row Details */}
                {isExpanded && (
                  <div className="px-5 py-4 border-b border-white/5 bg-white/[0.01]">
                    <div className="ml-[100px] space-y-3">
                      {item.outputUrl && (
                        <div>
                          <label className="text-[10px] uppercase font-semibold text-gray-600 mb-1 block">
                            Output URL
                          </label>
                          <code className="text-xs text-green-400 break-all">
                            {item.outputUrl}
                          </code>
                        </div>
                      )}
                      {item.captions && (
                        <div className="space-y-2">
                          {Object.entries(item.captions).map(([platform, caption]) => (
                            <div key={platform}>
                              <label className="text-[10px] uppercase font-semibold text-gray-600 mb-1 block">
                                {platform}
                              </label>
                              <p className="text-xs text-gray-400 whitespace-pre-wrap">
                                {caption as string}
                              </p>
                            </div>
                          ))}
                        </div>
                      )}
                      {item.details &&
                        Object.entries(item.details).map(([key, val]) => (
                          <div key={key}>
                            <label className="text-[10px] uppercase font-semibold text-gray-600 mb-1 block">
                              {key.replace(/_/g, " ")}
                            </label>
                            <p className="text-xs text-gray-400">
                              {typeof val === "string" ? val : JSON.stringify(val)}
                            </p>
                          </div>
                        ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-3 mt-5">
            <Button
              size="sm"
              variant="outline"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="border-white/10 text-gray-400 hover:text-white hover:bg-white/5"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
              Previous
            </Button>
            <span className="text-xs text-gray-500">
              Page {page} of {totalPages}
            </span>
            <Button
              size="sm"
              variant="outline"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              className="border-white/10 text-gray-400 hover:text-white hover:bg-white/5"
            >
              Next
              <ChevronRight className="w-3.5 h-3.5" />
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
