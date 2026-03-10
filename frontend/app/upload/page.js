import UploadForm from "../components/UploadForm";

export const metadata = {
  title: "Data Management — DBMS",
};

export default function UploadPage() {
  return (
    <div className="p-6 lg:p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight">Data Management</h1>
        <p className="mt-1 text-sm text-muted">
          Upload your own transaction datasets for private analysis, or manage the shared
          main database (admins only)
        </p>
      </div>

      <div className="mx-auto max-w-2xl">
        <UploadForm />
      </div>
    </div>
  );
}
