import { useState, useEffect, useCallback } from 'react';
import {
  AdminField,
  FieldValue,
  CleanupGroup,
  getFieldValues,
  renameFieldValue,
  deleteFieldValue,
  getCleanupGroups,
  fixCleanup,
} from '../api';

const TABS: { field: AdminField; label: string; noun: string }[] = [
  { field: 'editorial', label: 'Publishers', noun: 'publisher' },
  { field: 'author', label: 'Authors', noun: 'author' },
  { field: 'type', label: 'Types', noun: 'type' },
  { field: 'collection', label: 'Collections', noun: 'collection' },
  { field: 'tags', label: 'Tags', noun: 'tag' },
];

/** Renders otherwise-invisible differences so identical-looking rows can be told apart. */
const describeOddity = (value: string): string | null => {
  const notes: string[] = [];
  if (value !== value.trim()) notes.push('has surrounding spaces');
  if (value.trim() !== value.trim().normalize('NFC')) notes.push('decomposed accents');
  return notes.length ? notes.join(', ') : null;
};

export function Admin() {
  const [field, setField] = useState<AdminField>('editorial');
  const [values, setValues] = useState<FieldValue[]>([]);
  const [cleanup, setCleanup] = useState<CleanupGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [search, setSearch] = useState('');

  const tab = TABS.find((t) => t.field === field)!;

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [vals, groups] = await Promise.all([getFieldValues(field), getCleanupGroups()]);
      setValues(vals);
      setCleanup(groups);
    } catch {
      setError('Could not load admin data. Make sure the backend is running.');
    } finally {
      setLoading(false);
    }
  }, [field]);

  useEffect(() => {
    load();
  }, [load]);

  const startEdit = (value: string) => {
    setEditing(value);
    setDraft(value);
    setNotice(null);
  };

  const commitRename = async (from: string) => {
    const to = draft.trim();
    if (!to || to === from) {
      setEditing(null);
      return;
    }
    const existing = values.find((v) => v.value === to);
    const affected = values.find((v) => v.value === from)?.count ?? 0;
    if (
      existing &&
      !confirm(
        `"${to}" already exists with ${existing.count} book${existing.count === 1 ? '' : 's'}.\n\n` +
          `Merge "${from}" (${affected} book${affected === 1 ? '' : 's'}) into it? ` +
          `They'll become a single ${tab.noun} with ${existing.count + affected}.`
      )
    ) {
      return;
    }

    setBusy(true);
    try {
      const res = await renameFieldValue(field, from, to);
      setNotice(
        res.merged
          ? `Merged into “${to}” — ${res.updated} book${res.updated === 1 ? '' : 's'} updated.`
          : `Renamed to “${to}” — ${res.updated} book${res.updated === 1 ? '' : 's'} updated.`
      );
      setEditing(null);
      await load();
    } catch (e) {
      setNotice(`Failed: ${e instanceof Error ? e.message : 'unknown error'}`);
    } finally {
      setBusy(false);
    }
  };

  const remove = async (value: string, count: number) => {
    const what =
      field === 'author' || field === 'tags'
        ? `remove “${value}” from ${count} book${count === 1 ? '' : 's'}`
        : `clear the ${tab.noun} on ${count} book${count === 1 ? '' : 's'}`;
    if (!confirm(`This will ${what}.\n\nThis cannot be undone. Continue?`)) return;

    setBusy(true);
    try {
      const res = await deleteFieldValue(field, value);
      setNotice(`Removed “${value}” from ${res.updated} book${res.updated === 1 ? '' : 's'}.`);
      await load();
    } catch (e) {
      setNotice(`Failed: ${e instanceof Error ? e.message : 'unknown error'}`);
    } finally {
      setBusy(false);
    }
  };

  const runCleanup = async (scope?: AdminField) => {
    const groups = scope ? cleanup.filter((g) => g.field === scope) : cleanup;
    const books = groups.reduce((n, g) => n + g.affected, 0);
    if (
      !confirm(
        `Normalize ${groups.length} group${groups.length === 1 ? '' : 's'} of near-duplicate values, ` +
          `affecting about ${books} book entr${books === 1 ? 'y' : 'ies'}.\n\n` +
          `Values that differ only by spaces or accent encoding will be merged. Continue?`
      )
    )
      return;

    setBusy(true);
    try {
      const res = await fixCleanup(scope);
      setNotice(`Cleanup done — ${res.updated} book${res.updated === 1 ? '' : 's'} updated.`);
      await load();
    } catch (e) {
      setNotice(`Failed: ${e instanceof Error ? e.message : 'unknown error'}`);
    } finally {
      setBusy(false);
    }
  };

  const shown = values.filter((v) => v.value.toLowerCase().includes(search.toLowerCase()));
  const myCleanup = cleanup.filter((g) => g.field === field);

  return (
    <div className="pb-16">
      <h2 className="text-xl font-bold text-gray-800 mb-1">Admin</h2>
      <p className="text-xs text-gray-500 mb-4">
        Rename or remove values across every book at once. Renaming onto an existing name merges them.
      </p>

      {/* Entity tabs */}
      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
        {TABS.map((t) => {
          const pending = cleanup.filter((g) => g.field === t.field).length;
          return (
            <button
              key={t.field}
              onClick={() => {
                setField(t.field);
                setEditing(null);
                setNotice(null);
                setSearch('');
              }}
              className={`shrink-0 px-3 py-1.5 rounded-full text-sm font-medium border transition-colors ${
                field === t.field
                  ? 'bg-indigo-600 text-white border-indigo-600'
                  : 'bg-white text-gray-600 border-gray-300 hover:border-gray-400'
              }`}
            >
              {t.label}
              {pending > 0 && (
                <span
                  className={`ml-1.5 text-xs ${
                    field === t.field ? 'text-indigo-100' : 'text-amber-600'
                  }`}
                  title={`${pending} near-duplicate group(s)`}
                >
                  ⚠{pending}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {notice && (
        <div className="mt-3 rounded-xl border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-800">
          {notice}
        </div>
      )}

      {error && (
        <div className="mt-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Cleanup suggestions for the active field */}
      {myCleanup.length > 0 && (
        <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3">
          <div className="flex items-start gap-2">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-amber-900">
                {myCleanup.length} group{myCleanup.length === 1 ? '' : 's'} of near-duplicates
              </p>
              <p className="text-xs text-amber-700 mt-0.5">
                These look identical but are stored differently, so they sort and filter separately.
              </p>
            </div>
            <button
              onClick={() => runCleanup(field)}
              disabled={busy}
              className="shrink-0 bg-amber-600 text-white text-xs font-semibold px-3 py-1.5 rounded-lg hover:bg-amber-700 disabled:opacity-50"
            >
              Fix all
            </button>
          </div>
          <ul className="mt-2 space-y-1.5">
            {myCleanup.map((g) => (
              <li key={g.canonical} className="text-xs text-amber-900">
                <span className="font-medium">{g.canonical}</span>
                <span className="text-amber-600"> · {g.reason}</span>
                <span className="text-amber-700">
                  {' '}
                  ({g.variants.map((v) => `${v.count}`).join(' + ')} ={' '}
                  {g.variants.reduce((n, v) => n + v.count, 0)})
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Search within the list */}
      {values.length > 8 && (
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={`Search ${tab.label.toLowerCase()}…`}
          className="w-full mt-3 border border-gray-300 rounded-xl px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
      )}

      {loading && (
        <div className="flex justify-center items-center h-32">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
        </div>
      )}

      {!loading && !error && (
        <>
          <p className="text-xs text-gray-500 mt-3 mb-2">
            <span className="font-semibold text-gray-700">{shown.length}</span>
            {search && <> of {values.length}</>} {tab.label.toLowerCase()}
          </p>

          {shown.length === 0 && (
            <div className="text-center py-12 text-gray-400">
              <p className="text-4xl mb-2">🗂️</p>
              <p className="text-sm">
                {values.length === 0
                  ? `No ${tab.label.toLowerCase()} in the library yet`
                  : 'Nothing matches that search'}
              </p>
            </div>
          )}

          <ul className="space-y-2">
            {shown.map((v) => {
              const oddity = describeOddity(v.value);
              return (
                <li
                  key={v.value}
                  className="bg-white rounded-xl border border-gray-100 shadow-sm px-3 py-2.5"
                >
                  {editing === v.value ? (
                    <div className="flex gap-2">
                      <input
                        autoFocus
                        value={draft}
                        onChange={(e) => setDraft(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            commitRename(v.value);
                          }
                          if (e.key === 'Escape') setEditing(null);
                        }}
                        className="flex-1 min-w-0 border border-indigo-400 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                      <button
                        onClick={() => commitRename(v.value)}
                        disabled={busy}
                        className="shrink-0 bg-indigo-600 text-white text-xs font-semibold px-3 py-1.5 rounded-lg hover:bg-indigo-700 disabled:opacity-50"
                      >
                        Save
                      </button>
                      <button
                        onClick={() => setEditing(null)}
                        className="shrink-0 border border-gray-300 text-gray-600 text-xs font-medium px-3 py-1.5 rounded-lg hover:bg-gray-50"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm text-gray-800 truncate">{v.value}</p>
                        <p className="text-xs text-gray-400">
                          {v.count} book{v.count === 1 ? '' : 's'}
                          {oddity && <span className="text-amber-600"> · {oddity}</span>}
                        </p>
                      </div>
                      <button
                        onClick={() => startEdit(v.value)}
                        disabled={busy}
                        className="shrink-0 text-xs font-medium text-indigo-600 hover:text-indigo-800 disabled:opacity-50"
                      >
                        Rename
                      </button>
                      <button
                        onClick={() => remove(v.value, v.count)}
                        disabled={busy}
                        className="shrink-0 text-xs font-medium text-red-500 hover:text-red-700 disabled:opacity-50"
                      >
                        {field === 'author' || field === 'tags' ? 'Remove' : 'Clear'}
                      </button>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>

          {field === 'tags' && values.length > 0 && (
            <p className="text-xs text-gray-400 mt-4 leading-relaxed">
              Note: the tag picker in the book form is a fixed list in the source code. Renaming a tag
              here updates the books but not that list, so a renamed tag won’t be offered for new books
              until the list is edited too.
            </p>
          )}
        </>
      )}
    </div>
  );
}
