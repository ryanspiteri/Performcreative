import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Save, Package, FileText, Loader2, CheckCircle, AlertCircle } from "lucide-react";
import ProductRendersPanel from "@/components/ProductRendersPanel";

const ACTIVE_PRODUCTS = ["Hyperburn", "Thermosleep", "Hyperload", "Thermoburn", "Carb Control"];

const FIELDS = [
  { key: "ingredients", label: "Ingredients", placeholder: "List key ingredients (e.g., L-Carnitine, Green Tea Extract, Caffeine Anhydrous...)", rows: 4 },
  { key: "benefits", label: "Benefits", placeholder: "Key benefits of this product (e.g., Supports fat metabolism, Increases energy levels...)", rows: 3 },
  { key: "claims", label: "Claims", placeholder: "Approved marketing claims (e.g., Clinically dosed, Australian made...)", rows: 3 },
  { key: "targetAudience", label: "Target Audience", placeholder: "Who is this product for? (e.g., Active adults 25-45, fitness enthusiasts looking to lean out...)", rows: 3 },
  { key: "keySellingPoints", label: "Key Selling Points", placeholder: "Top selling points for ads (e.g., No proprietary blends, Transparent dosing...)", rows: 3 },
  { key: "flavourVariants", label: "Flavour Variants", placeholder: "Available flavours (e.g., Grape, Mango, Lime Splice, Pink Lemonade...)", rows: 2 },
  { key: "pricing", label: "Pricing", placeholder: "Pricing info (e.g., $59.95 AUD / 40 serves, Subscribe & Save 15% off...)", rows: 2 },
  { key: "additionalNotes", label: "Additional Notes", placeholder: "Any other info the AI should know (e.g., Recently reformulated, Pairs well with Thermoburn...)", rows: 3 },
] as const;

type FieldKey = typeof FIELDS[number]["key"];

export default function ProductInfoHub() {
  const [selectedProduct, setSelectedProduct] = useState<string>(ACTIVE_PRODUCTS[0]);
  const [formData, setFormData] = useState<Record<string, string>>({});
  const [isDirty, setIsDirty] = useState(false);

  const utils = trpc.useUtils();

  // Fetch info for selected product
  const infoQuery = trpc.productInfo.get.useQuery({ product: selectedProduct });
  const allInfoQuery = trpc.productInfo.list.useQuery();

  const upsertMutation = trpc.productInfo.upsert.useMutation({
    onSuccess: () => {
      toast.success(`${selectedProduct} info saved!`);
      utils.productInfo.get.invalidate({ product: selectedProduct });
      utils.productInfo.list.invalidate();
      setIsDirty(false);
    },
    onError: (err) => {
      toast.error("Save failed: " + err.message);
    },
  });

  // Populate form when data loads
  useEffect(() => {
    if (infoQuery.data) {
      const data: Record<string, string> = {};
      for (const field of FIELDS) {
        data[field.key] = (infoQuery.data as any)[field.key] || "";
      }
      setFormData(data);
      setIsDirty(false);
    } else if (!infoQuery.isLoading) {
      // No data yet — empty form
      const data: Record<string, string> = {};
      for (const field of FIELDS) {
        data[field.key] = "";
      }
      setFormData(data);
      setIsDirty(false);
    }
  }, [infoQuery.data, infoQuery.isLoading, selectedProduct]);

  const handleFieldChange = (key: string, value: string) => {
    setFormData((prev) => ({ ...prev, [key]: value }));
    setIsDirty(true);
  };

  const handleSave = () => {
    upsertMutation.mutate({
      product: selectedProduct,
      ...formData,
    });
  };

  // Check which products have info saved
  const productsWithInfo = new Set((allInfoQuery.data || []).map((p) => p.product));

  // Calculate completion percentage for current product
  const filledFields = FIELDS.filter((f) => formData[f.key]?.trim()).length;
  const completionPct = Math.round((filledFields / FIELDS.length) * 100);

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">Product Information</h1>
          <p className="text-gray-400 text-sm">
            Enter product details that the AI pipeline uses for briefs and scripts. The more detail you provide, the better the output.
          </p>
        </div>
        {isDirty && (
          <Button
            onClick={handleSave}
            disabled={upsertMutation.isPending}
            className="bg-[#FF3838] hover:bg-[#FF3838]/90 text-white"
          >
            {upsertMutation.isPending ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Save className="w-4 h-4 mr-2" />
            )}
            Save Changes
          </Button>
        )}
      </div>

      {/* Product Tabs */}
      <div className="flex gap-2 flex-wrap">
        {ACTIVE_PRODUCTS.map((p) => (
          <button
            key={p}
            onClick={() => {
              if (isDirty) {
                if (!confirm("You have unsaved changes. Switch product anyway?")) return;
              }
              setSelectedProduct(p);
            }}
            className={`px-4 py-2.5 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${
              selectedProduct === p
                ? "bg-[#FF3838] text-white shadow-lg shadow-[#FF3838]/20"
                : "bg-[#191B1F] text-gray-400 hover:text-white border border-white/10 hover:border-white/20"
            }`}
          >
            <Package className="w-4 h-4" />
            {p}
            {productsWithInfo.has(p) ? (
              <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
            ) : (
              <AlertCircle className="w-3.5 h-3.5 text-yellow-500" />
            )}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Form */}
        <div className="lg:col-span-3">
          <div className="bg-[#191B1F] border border-white/5 rounded-xl p-6 space-y-6">
            {infoQuery.isLoading ? (
              <div className="flex items-center justify-center h-64">
                <Loader2 className="w-8 h-8 animate-spin text-[#FF3838]" />
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-lg font-bold text-white">
                    <FileText className="w-5 h-5 inline mr-2 text-[#FF3838]" />
                    {selectedProduct} Details
                  </h3>
                  <span className="text-xs text-gray-400">
                    {filledFields}/{FIELDS.length} fields completed
                  </span>
                </div>

                {FIELDS.map((field) => (
                  <div key={field.key}>
                    <label className="text-sm font-medium text-gray-300 mb-2 block">
                      {field.label}
                    </label>
                    <textarea
                      value={formData[field.key] || ""}
                      onChange={(e) => handleFieldChange(field.key, e.target.value)}
                      placeholder={field.placeholder}
                      rows={field.rows}
                      className="w-full bg-[#0F1117] border border-white/10 rounded-lg px-4 py-3 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-[#FF3838]/50 focus:ring-1 focus:ring-[#FF3838]/30 transition-all resize-none"
                    />
                  </div>
                ))}

                {/* Save Button (bottom) */}
                <div className="flex justify-end pt-4 border-t border-white/5">
                  <Button
                    onClick={handleSave}
                    disabled={upsertMutation.isPending || !isDirty}
                    className="bg-[#FF3838] hover:bg-[#FF3838]/90 text-white disabled:opacity-50"
                  >
                    {upsertMutation.isPending ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <Save className="w-4 h-4 mr-2" />
                    )}
                    Save {selectedProduct} Info
                  </Button>
                </div>
              </>
            )}
          </div>

          {/* Product Renders */}
          <ProductRendersPanel selectedProduct={selectedProduct} />
        </div>

        {/* Sidebar Stats */}
        <div className="lg:col-span-1">
          <div className="bg-[#191B1F] border border-white/5 rounded-xl p-6 sticky top-6 space-y-6">
            <h3 className="text-lg font-bold text-white">Completion</h3>

            {/* Progress Ring */}
            <div className="flex flex-col items-center">
              <div className="relative w-24 h-24">
                <svg className="w-24 h-24 -rotate-90" viewBox="0 0 100 100">
                  <circle cx="50" cy="50" r="40" fill="none" stroke="#1F2937" strokeWidth="8" />
                  <circle
                    cx="50" cy="50" r="40" fill="none"
                    stroke={completionPct >= 75 ? "#10B981" : completionPct >= 50 ? "#F59E0B" : "#EF4444"}
                    strokeWidth="8"
                    strokeDasharray={`${completionPct * 2.51} 251`}
                    strokeLinecap="round"
                  />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-xl font-bold text-white">{completionPct}%</span>
                </div>
              </div>
              <p className="text-xs text-gray-400 mt-2">{selectedProduct}</p>
            </div>

            {/* All Products Status */}
            <div className="space-y-3 pt-4 border-t border-white/5">
              <h4 className="text-xs font-medium text-gray-400 uppercase tracking-wider">All Products</h4>
              {ACTIVE_PRODUCTS.map((p) => {
                const hasInfo = productsWithInfo.has(p);
                return (
                  <div key={p} className="flex items-center justify-between">
                    <span className="text-sm text-gray-300">{p}</span>
                    {hasInfo ? (
                      <CheckCircle className="w-4 h-4 text-emerald-400" />
                    ) : (
                      <AlertCircle className="w-4 h-4 text-yellow-500" />
                    )}
                  </div>
                );
              })}
            </div>

            {/* Info */}
            <div className="pt-4 border-t border-white/5">
              <p className="text-xs text-gray-500">
                Product info is automatically injected into AI briefs and scripts. More detail = better creative output.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
