import { useState } from 'react';
import { Paperclip } from 'lucide-react';
import { useToast } from '../../context/ToastContext';
import { getSignedFileUrl } from '../../services/api';

// Opens a private FileAsset (assignment/submission attachment) in a new tab
// via a freshly signed, short-lived URL. `attachment` is the join-row shape
// returned by the API: { fileAsset: { storageKey, originalName, ... } }.
export default function AttachmentChip({ attachment }) {
  const [loading, setLoading] = useState(false);
  const { showToast } = useToast();
  const open = async () => {
    setLoading(true);
    try {
      const { url } = await getSignedFileUrl(attachment.fileAsset.storageKey);
      window.open(url, '_blank', 'noopener');
    } catch (err) {
      showToast(err?.response?.data?.message || 'Файлыг нээхэд алдаа гарлаа', 'error');
    } finally {
      setLoading(false);
    }
  };
  return (
    <button
      type="button"
      onClick={open}
      disabled={loading}
      className="inline-flex items-center gap-1 rounded-full bg-white border border-slate-200 px-2.5 py-1 text-[11px] text-indigo-600 hover:bg-indigo-50 disabled:opacity-50"
    >
      <Paperclip size={11} /> {attachment.fileAsset.originalName}
    </button>
  );
}
