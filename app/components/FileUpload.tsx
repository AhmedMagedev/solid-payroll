'use client';

import { useState, useRef } from 'react';
import { Button } from "@/components/ui/button";
import { useRouter } from 'next/navigation';
import { toast } from "sonner";

export const FileUpload = () => {
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  const handleUploadClick = () => {
    // Trigger the hidden file input
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Check if it's a valid file type
    if (file.name.split('.').pop()?.toLowerCase() !== 'dat') {
      toast.error("Invalid file type", { description: "Please upload a .dat file" });
      return;
    }

    // Clear the input (so the same file can be selected again later if needed)
    e.target.value = '';

    try {
      setIsUploading(true);
      toast("Processing file...", { 
        description: "Uploading and parsing employee data.",
        duration: 3000
      });
      
      // Create FormData and append the file
      const formData = new FormData();
      formData.append('file', file);
      
      // Send the file to our API route
      const response = await fetch('/api/employees/upload', {
        method: 'POST',
        body: formData,
      });
      
      const result = await response.json();
      
      if (response.ok) {
        if (result.createdCount > 0) {
          toast.success("Upload successful", { 
            description: `${result.createdCount} employees were added to the system.${result.errorCount > 0 ? ` (${result.errorCount} duplicates skipped)` : ''}`,
            duration: 5000
          });
        } else if (result.errorCount > 0 && result.totalFound > 0) {
          toast.warning("Upload completed with warnings", {
            description: `${result.errorCount} employees were skipped (already exist in database).`,
            duration: 5000
          });
        } else {
          toast.info("No changes made", {
            description: "No new employees were added to the system.",
            duration: 5000
          });
        }
        
        // Refresh the page to show the new employees
        router.refresh();
      } else {
        toast.error("Upload failed", { 
          description: result.details || result.error || "Failed to process the file",
          duration: 8000
        });
      }
    } catch (error) {
      console.error("Error uploading file:", error);
      toast.error("Upload error", { 
        description: "An unexpected error occurred while uploading the file",
        duration: 5000
      });
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div>
      {/* Hidden file input */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        accept=".dat"
        style={{ display: 'none' }}
      />
      
      {/* Visible Upload button */}
      <Button 
        onClick={handleUploadClick} 
        disabled={isUploading}
      >
        {isUploading ? 'Uploading...' : 'Upload Employees'}
      </Button>
    </div>
  );
}; 