import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Star, Plus, Trash2, Edit2, Check, X } from "lucide-react";
import { toast } from "sonner";

const ACTIVE_PRODUCTS = ["Hyperburn", "Thermosleep", "Hyperload", "Thermoburn", "Carb Control"];
const ANGLES = ["transformation", "urgency", "social_proof", "curiosity", "benefit_driven", "problem_solution", "authority", "scarcity"];
const FORMATS = ["static", "video", "ugc"];

export default function HeadlineBank() {
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  
  // Form state
  const [headline, setHeadline] = useState("");
  const [subheadline, setSubheadline] = useState("");
  const [rating, setRating] = useState(3);
  const [roas, setRoas] = useState("");
  const [spend, setSpend] = useState("");
  const [weeksActive, setWeeksActive] = useState("");
  const [product, setProduct] = useState("");
  const [angle, setAngle] = useState("");
  const [format, setFormat] = useState("");
  const [notes, setNotes] = useState("");

  const utils = trpc.useUtils();
  const { data: headlines, isLoading } = trpc.headlineBank.list.useQuery();
  const createMutation = trpc.headlineBank.create.useMutation({
    onSuccess: () => {
      utils.headlineBank.list.invalidate();
      resetForm();
      toast.success("Headline added to bank");
    },
    onError: (error) => {
      toast.error(`Failed to add headline: ${error.message}`);
    },
  });
  
  const updateMutation = trpc.headlineBank.update.useMutation({
    onSuccess: () => {
      utils.headlineBank.list.invalidate();
      resetForm();
      setEditingId(null);
      toast.success("Headline updated");
    },
    onError: (error) => {
      toast.error(`Failed to update headline: ${error.message}`);
    },
  });
  
  const deleteMutation = trpc.headlineBank.delete.useMutation({
    onSuccess: () => {
      utils.headlineBank.list.invalidate();
      toast.success("Headline deleted");
    },
    onError: (error) => {
      toast.error(`Failed to delete headline: ${error.message}`);
    },
  });

  const resetForm = () => {
    setHeadline("");
    setSubheadline("");
    setRating(3);
    setRoas("");
    setSpend("");
    setWeeksActive("");
    setProduct("");
    setAngle("");
    setFormat("");
    setNotes("");
    setShowForm(false);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!headline.trim()) {
      toast.error("Headline is required");
      return;
    }

    const data = {
      headline: headline.trim(),
      subheadline: subheadline.trim() || undefined,
      rating,
      roas: roas.trim() || undefined,
      spend: spend.trim() || undefined,
      weeksActive: weeksActive ? parseInt(weeksActive) : undefined,
      product: product || undefined,
      angle: angle || undefined,
      format: format || undefined,
      notes: notes.trim() || undefined,
    };

    if (editingId) {
      updateMutation.mutate({ id: editingId, ...data });
    } else {
      createMutation.mutate(data);
    }
  };

  const handleEdit = (h: any) => {
    setEditingId(h.id);
    setHeadline(h.headline);
    setSubheadline(h.subheadline || "");
    setRating(h.rating);
    setRoas(h.roas || "");
    setSpend(h.spend || "");
    setWeeksActive(h.weeksActive?.toString() || "");
    setProduct(h.product || "");
    setAngle(h.angle || "");
    setFormat(h.format || "");
    setNotes(h.notes || "");
    setShowForm(true);
  };

  const handleDelete = (id: number) => {
    if (confirm("Are you sure you want to delete this headline?")) {
      deleteMutation.mutate({ id });
    }
  };

  const renderStars = (rating: number) => {
    return (
      <div className="flex gap-0.5">
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            className={`w-4 h-4 ${
              star <= rating
                ? "fill-yellow-500 text-yellow-500"
                : "fill-none text-gray-300"
            }`}
          />
        ))}
      </div>
    );
  };

  return (
    <div className="container py-8">
      <div className="flex justify-between items-start mb-8">
        <div>
          <h1 className="text-3xl font-bold mb-2">Headline Bank</h1>
          <p className="text-muted-foreground">
            Store your proven winning headlines from Motion analytics. The Iterate Winners pipeline will use these instead of AI guesses.
          </p>
        </div>
        <Button onClick={() => setShowForm(!showForm)}>
          {showForm ? (
            <>
              <X className="w-4 h-4 mr-2" />
              Cancel
            </>
          ) : (
            <>
              <Plus className="w-4 h-4 mr-2" />
              Add Headline
            </>
          )}
        </Button>
      </div>

      {showForm && (
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>{editingId ? "Edit Headline" : "Add New Headline"}</CardTitle>
            <CardDescription>
              Enter your proven winning headline from Motion or manual entry
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <Label htmlFor="headline">Headline *</Label>
                  <Input
                    id="headline"
                    value={headline}
                    onChange={(e) => setHeadline(e.target.value)}
                    placeholder="e.g., LOST WEIGHT LOOKS HEAVIER"
                    required
                  />
                </div>

                <div className="md:col-span-2">
                  <Label htmlFor="subheadline">Subheadline (Optional)</Label>
                  <Input
                    id="subheadline"
                    value={subheadline}
                    onChange={(e) => setSubheadline(e.target.value)}
                    placeholder="e.g., See real changes in just days"
                  />
                </div>

                <div>
                  <Label htmlFor="rating">Rating (1-5 stars)</Label>
                  <Select value={rating.toString()} onValueChange={(v) => setRating(parseInt(v))}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {[1, 2, 3, 4, 5].map((r) => (
                        <SelectItem key={r} value={r.toString()}>
                          {r} {r === 1 ? "star" : "stars"}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="roas">ROAS</Label>
                  <Input
                    id="roas"
                    value={roas}
                    onChange={(e) => setRoas(e.target.value)}
                    placeholder="e.g., 0.87, 1.25"
                  />
                </div>

                <div>
                  <Label htmlFor="spend">Spend</Label>
                  <Input
                    id="spend"
                    value={spend}
                    onChange={(e) => setSpend(e.target.value)}
                    placeholder="e.g., A$5,223.83"
                  />
                </div>

                <div>
                  <Label htmlFor="weeksActive">Weeks Active</Label>
                  <Input
                    id="weeksActive"
                    type="number"
                    value={weeksActive}
                    onChange={(e) => setWeeksActive(e.target.value)}
                    placeholder="e.g., 5"
                  />
                </div>

                <div>
                  <Label htmlFor="product">Product</Label>
                  <Select value={product} onValueChange={setProduct}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select product" />
                    </SelectTrigger>
                    <SelectContent>
                      {ACTIVE_PRODUCTS.map((p) => (
                        <SelectItem key={p} value={p}>
                          {p}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="angle">Angle</Label>
                  <Select value={angle} onValueChange={setAngle}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select angle" />
                    </SelectTrigger>
                    <SelectContent>
                      {ANGLES.map((a) => (
                        <SelectItem key={a} value={a}>
                          {a}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="format">Format</Label>
                  <Select value={format} onValueChange={setFormat}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select format" />
                    </SelectTrigger>
                    <SelectContent>
                      {FORMATS.map((f) => (
                        <SelectItem key={f} value={f}>
                          {f}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="md:col-span-2">
                  <Label htmlFor="notes">Notes</Label>
                  <Textarea
                    id="notes"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Any additional notes about this headline..."
                    rows={3}
                  />
                </div>
              </div>

              <div className="flex gap-2">
                <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
                  {editingId ? (
                    <>
                      <Check className="w-4 h-4 mr-2" />
                      Update Headline
                    </>
                  ) : (
                    <>
                      <Plus className="w-4 h-4 mr-2" />
                      Add Headline
                    </>
                  )}
                </Button>
                {editingId && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      resetForm();
                      setEditingId(null);
                    }}
                  >
                    Cancel
                  </Button>
                )}
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      <div className="space-y-4">
        {isLoading && <p className="text-muted-foreground">Loading headlines...</p>}
        
        {headlines && headlines.length === 0 && (
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-muted-foreground mb-4">
                No headlines yet. Add your first proven winner!
              </p>
              <Button onClick={() => setShowForm(true)}>
                <Plus className="w-4 h-4 mr-2" />
                Add Headline
              </Button>
            </CardContent>
          </Card>
        )}

        {headlines?.map((h) => (
          <Card key={h.id}>
            <CardContent className="py-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 space-y-2">
                  <div className="flex items-center gap-3">
                    {renderStars(h.rating)}
                    <span className="text-xs text-muted-foreground">
                      {h.source === "manual" ? "Manual Entry" : h.source}
                    </span>
                  </div>
                  
                  <h3 className="text-lg font-bold">{h.headline}</h3>
                  {h.subheadline && (
                    <p className="text-muted-foreground">{h.subheadline}</p>
                  )}

                  <div className="flex flex-wrap gap-2 text-sm">
                    {h.product && (
                      <span className="px-2 py-1 bg-primary/10 text-primary rounded">
                        {h.product}
                      </span>
                    )}
                    {h.angle && (
                      <span className="px-2 py-1 bg-blue-500/10 text-blue-500 rounded">
                        {h.angle}
                      </span>
                    )}
                    {h.format && (
                      <span className="px-2 py-1 bg-green-500/10 text-green-500 rounded">
                        {h.format}
                      </span>
                    )}
                    {h.roas && (
                      <span className="px-2 py-1 bg-yellow-500/10 text-yellow-500 rounded">
                        ROAS: {h.roas}
                      </span>
                    )}
                    {h.spend && (
                      <span className="px-2 py-1 bg-purple-500/10 text-purple-500 rounded">
                        Spend: {h.spend}
                      </span>
                    )}
                    {h.weeksActive && (
                      <span className="px-2 py-1 bg-orange-500/10 text-orange-500 rounded">
                        {h.weeksActive} weeks
                      </span>
                    )}
                  </div>

                  {h.notes && (
                    <p className="text-sm text-muted-foreground italic">{h.notes}</p>
                  )}
                </div>

                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleEdit(h)}
                  >
                    <Edit2 className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleDelete(h.id)}
                    disabled={deleteMutation.isPending}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
