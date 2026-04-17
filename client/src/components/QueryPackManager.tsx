import React, { useState, useEffect } from "react";
import {
  Save,
  Trash2,
  Play,
  Loader2,
  Plus,
  AlertCircle,
  History,
} from "lucide-react";
import toast from "react-hot-toast";
import type { QueryPack } from "../../../shared/types";
import Spinner from './Spinner';
import {
  createQueryPack,
  listQueryPacks,
  deleteQueryPack,
  executeQueryPack,
  updateQueryPack,
} from "../api";
import ModalPanel from "./ModalPanel";

interface QueryPackManagerProps {
  isOpen: boolean;
  onClose: () => void;
  currentQueries: string[];
  url: string;
  defaultClientName?: string;
  onPackSelected: (queries: string[]) => void;
  onPackExecuted: (testId: string) => void;
}

type ListQueryPacksResponse = {
  packs?: QueryPack[];
};

type CreateQueryPackResponse = {
  pack: QueryPack;
};

type ExecuteQueryPackResponse = {
  test_id: string;
};

export default function QueryPackManager({
  isOpen,
  onClose,
  currentQueries,
  url,
  defaultClientName,
  onPackSelected,
  onPackExecuted,
}: QueryPackManagerProps) {
  const [packs, setPacks] = useState<QueryPack[]>([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [executing, setExecuting] = useState<string | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    client_name: defaultClientName || "",
    tags: [] as string[],
  });

  useEffect(() => {
    if (!showCreateForm) {
      setFormData((prev) => ({ ...prev, client_name: defaultClientName || "" }));
    }
  }, [defaultClientName, showCreateForm]);

  useEffect(() => {
    if (isOpen) {
      loadPacks();
    }
  }, [isOpen]);

  async function loadPacks() {
    setLoading(true);
    try {
      const response = (await listQueryPacks()) as ListQueryPacksResponse;
      setPacks(response.packs || []);
    } catch (err) {
      console.error("Failed to load packs:", err);
      toast.error("Failed to load query packs");
    } finally {
      setLoading(false);
    }
  }

  async function handleSavePack() {
    if (!formData.name.trim()) {
      toast.error("Pack name required");
      return;
    }

    setCreating(true);
    try {
      const response = (await createQueryPack({
        name: formData.name,
        description: formData.description,
        queries: currentQueries,
        tags: formData.tags,
        client_name: formData.client_name,
      })) as CreateQueryPackResponse;

      setPacks([response.pack, ...packs]);
      setFormData({ name: "", description: "", client_name: defaultClientName || "", tags: [] });
      setShowCreateForm(false);
      toast.success(`Saved: ${formData.name}`);
    } catch (err: any) {
      console.error("Failed to save pack:", err);
      toast.error(err.message || "Failed to save pack");
    } finally {
      setCreating(false);
    }
  }

  async function handleDeletePack(packId: string) {
    if (!window.confirm("Delete this query pack?")) return;

    try {
      await deleteQueryPack(packId);
      setPacks(packs.filter((p) => p.id !== packId));
      toast.success("Pack deleted");
    } catch (err) {
      console.error("Failed to delete pack:", err);
      toast.error("Failed to delete pack");
    }
  }

  async function handleExecutePack(pack: QueryPack) {
    setExecuting(pack.id);
    try {
      const response = (await executeQueryPack(pack.id, { url })) as ExecuteQueryPackResponse;
      onPackExecuted(response.test_id);
      toast.success("Pack execution started");
      onClose();
    } catch (err: any) {
      console.error("Failed to execute pack:", err);
      toast.error(err.message || "Failed to execute pack");
    } finally {
      setExecuting(null);
    }
  }

  function handleSelectPack(pack: QueryPack) {
    onPackSelected(pack.queries);
    toast.success(`Loaded: ${pack.name}`);
  }

  if (!isOpen) return null;

  return (
    <ModalPanel
      isOpen={isOpen}
      onClose={onClose}
      title="Reusable Query Packs"
      subtitle="Save and rerun tests for agencies and teams."
      icon={<History className="w-5 h-5 text-white/85" />}
      maxWidthClass="max-w-2xl"
      zIndexClass="z-[220]"
    >

        {/* Save Current Queries */}
        {currentQueries.length > 0 && (
          <div className="mb-6 p-4 rounded-lg border border-white/15 bg-charcoal/40">
            <p className="text-xs text-white/55 uppercase tracking-wide mb-3">Save Current Query Set</p>
            {!showCreateForm ? (
              <button
                onClick={() => setShowCreateForm(true)}
                className="w-full flex items-center gap-2 px-4 py-2 rounded-lg bg-white/10 hover:bg-white/15 text-white/85 transition-colors"
              >
                <Plus className="w-4 h-4" />
                Save as New Pack ({currentQueries.length} queries)
              </button>
            ) : (
              <div className="space-y-3">
                <input
                  type="text"
                  placeholder="Pack name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg bg-charcoal border border-white/10 text-white/85 placeholder:text-white/40 focus:outline-none focus:border-white/30"
                />
                <input
                  type="text"
                  placeholder="Client name (optional)"
                  value={formData.client_name}
                  onChange={(e) => setFormData({ ...formData, client_name: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg bg-charcoal border border-white/10 text-white/85 placeholder:text-white/40 focus:outline-none focus:border-white/30"
                />
                <textarea
                  placeholder="Description (optional)"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows={2}
                  className="w-full px-3 py-2 rounded-lg bg-charcoal border border-white/10 text-white/85 placeholder:text-white/40 focus:outline-none focus:border-white/30 resize-none"
                />
                <div className="flex gap-2">
                  <button
                    onClick={handleSavePack}
                    disabled={creating}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-white/10 hover:bg-white/15 text-white/85 transition-colors disabled:opacity-50"
                  >
                    {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                    Save Pack
                  </button>
                  <button
                    onClick={() => setShowCreateForm(false)}
                    className="flex-1 px-4 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-white/60 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Saved Packs */}
        <div>
          <p className="text-xs text-white/55 uppercase tracking-wide mb-3">Saved Packs</p>

          {loading ? (
            <div className="flex justify-center items-center py-8">
              <Spinner className="w-6 h-6" />
            </div>
          ) : packs.length === 0 ? (
            <div className="text-center py-8">
              <AlertCircle className="w-8 h-8 text-white/40 mx-auto mb-2" />
              <p className="text-white/60">No saved query packs yet</p>
              <p className="text-xs text-white/40 mt-1">Save your current queries to reuse them</p>
            </div>
          ) : (
            <div className="space-y-2">
              {packs.map((pack) => (
                <div
                  key={pack.id}
                  className="p-4 rounded-lg border border-white/10 bg-charcoal hover:border-white/20 transition-colors"
                >
                  <div className="flex items-start justify-between gap-4 mb-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="text-sm font-semibold text-white truncate">{pack.name}</h3>
                        {pack.client_name && (
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/10 text-white/70">
                            {pack.client_name}
                          </span>
                        )}
                      </div>
                      {pack.description && (
                        <p className="text-xs text-white/55 line-clamp-1 mb-1">{pack.description}</p>
                      )}
                      <div className="flex items-center gap-2 text-[10px] text-white/50">
                        <span>{pack.queries.length} queries</span>
                        <span>•</span>
                        <span>{pack.execution_count} runs</span>
                        {pack.last_executed_at && (
                          <>
                            <span>•</span>
                            <span>Last run {new Date(pack.last_executed_at).toLocaleDateString()}</span>
                          </>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 flex-shrink-0">
                      <button
                        onClick={() => handleSelectPack(pack)}
                        className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-white/60 hover:text-white/80 transition-colors"
                        title="Load queries"
                      >
                        <Plus className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleExecutePack(pack)}
                        disabled={executing === pack.id}
                        className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-white/60 hover:text-white/80 transition-colors disabled:opacity-50"
                        title="Execute pack"
                      >
                        {executing === pack.id ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Play className="w-4 h-4" />
                        )}
                      </button>
                      <button
                        onClick={() => handleDeletePack(pack.id)}
                        className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-white/60 hover:text-white/80 transition-colors"
                        title="Delete pack"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
    </ModalPanel>
  );
}
