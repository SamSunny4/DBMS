import UploadForm from "../components/UploadForm";

export const metadata = {
  title: "Upload Transactions — CryptoSentinel",
};

export default function UploadPage() {
  return (
    <div className="p-6 lg:p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight">
          Upload Transactions
        </h1>
        <p className="mt-1 text-sm text-muted">
          Import blockchain transaction datasets for analysis
        </p>
      </div>

      <div className="mx-auto max-w-2xl">
        <UploadForm />
      </div>
    </div>
  );
}
