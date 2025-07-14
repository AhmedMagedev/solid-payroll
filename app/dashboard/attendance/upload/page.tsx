'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertCircle, CheckCircle2, Upload, Info, Clock, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { Progress } from '@/components/ui/progress';

export default function AttendanceUploadPage() {
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [progressMessage, setProgressMessage] = useState('');
  const [uploadResult, setUploadResult] = useState<{ 
    success?: boolean; 
    message?: string; 
    error?: string;
    recordsCount?: number;
    payouts?: {
      created: number;
      updated: number;
      total: number;
    };
  } | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setFile(e.target.files[0]);
      setUploadResult(null);
      setUploadProgress(0);
      setProgressMessage('');
    }
  };

  const simulateProgress = () => {
    setUploadProgress(15);
    setProgressMessage('Reading attendance file...');
    
    setTimeout(() => {
      setUploadProgress(35);
      setProgressMessage('Parsing attendance records...');
    }, 600);
    
    setTimeout(() => {
      setUploadProgress(55);
      setProgressMessage('Processing employee check-ins...');
    }, 1200);
    
    setTimeout(() => {
      setUploadProgress(75);
      setProgressMessage('Calculating hours worked...');
    }, 1800);
    
    setTimeout(() => {
      setUploadProgress(90);
      setProgressMessage('Updating payroll calculations...');
    }, 2400);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!file) {
      setUploadResult({
        success: false,
        error: 'Please select a file to upload.'
      });
      return;
    }
    
    setIsUploading(true);
    setUploadResult(null);
    setUploadProgress(0);
    setProgressMessage('');
    
    // Start progress simulation
    simulateProgress();
    
    try {
      const formData = new FormData();
      formData.append('file', file);
      
      const response = await fetch('/api/attendance/upload', {
        method: 'POST',
        body: formData,
        credentials: 'include',
      });
      
      const data = await response.json();
      
      // Debug logging
      console.log('Upload response status:', response.status);
      console.log('Upload response data:', data);
      
      // Complete progress
      setUploadProgress(100);
      setProgressMessage('Processing complete!');
      
      if (response.ok) {
        setUploadResult({
          success: true,
          message: data.message || 'Attendance log processed successfully.',
          recordsCount: data.recordsCount,
          payouts: data.payouts
        });
        setFile(null);
        
        // Reset the file input
        const fileInput = document.getElementById('file-upload') as HTMLInputElement;
        if (fileInput) {
          fileInput.value = '';
        }
      } else {
        setUploadResult({
          success: false,
          error: data.error || 'Failed to process attendance log.'
        });
      }
    } catch {
      setUploadResult({
        success: false,
        error: 'An error occurred while uploading the file.'
      });
    } finally {
      setIsUploading(false);
      // Keep progress visible for a moment
      setTimeout(() => {
        setUploadProgress(0);
        setProgressMessage('');
      }, 2000);
    }
  };

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8">
        <div>
          <h1 className="text-2xl font-bold">Upload Attendance Logs</h1>
          <p className="text-muted-foreground mt-1">Upload and process employee attendance data</p>
        </div>
        <div className="mt-4 md:mt-0">
          <Button variant="outline" asChild>
            <Link href="/dashboard/attendance">
              View All Attendance Records
            </Link>
          </Button>
        </div>
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-8 mb-12">
        <Card className="lg:col-span-2 shadow-sm">
          <CardHeader className="bg-muted/20 border-b">
            <div className="flex items-center">
              <Upload className="h-5 w-5 mr-2 text-primary" />
              <CardTitle>Upload Attendance Log</CardTitle>
            </div>
            <CardDescription>
              Upload attendance log file to process employee check-in and check-out times.
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-6">
            <form onSubmit={handleSubmit}>
              <div className="mb-6">
                <Label htmlFor="file-upload" className="text-base font-medium">Attendance Log File</Label>
                <div className="mt-2">
                  <Input
                    id="file-upload"
                    type="file"
                    accept=".txt,.dat"
                    onChange={handleFileChange}
                    className="cursor-pointer"
                    disabled={isUploading}
                  />
                </div>
                <p className="text-sm text-muted-foreground mt-2">
                  Select a .dat or .txt file containing attendance records.
                </p>
              </div>
              
              {/* Progress Bar */}
              {isUploading && (
                <div className="mb-6 space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Processing...</span>
                    <span className="font-medium">{uploadProgress}%</span>
                  </div>
                  <Progress value={uploadProgress} className="h-2" />
                  {progressMessage && (
                    <p className="text-sm text-muted-foreground flex items-center">
                      <Loader2 className="h-3 w-3 mr-2 animate-spin" />
                      {progressMessage}
                    </p>
                  )}
                </div>
              )}
              
              <Button 
                type="submit" 
                disabled={isUploading || !file}
                className="w-full"
              >
                {isUploading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Processing...
                  </>
                ) : (
                  'Upload and Process Attendance'
                )}
              </Button>
            </form>
            
            {uploadResult && (
              <div className="mt-6">
                {uploadResult.success ? (
                  <Alert className="bg-green-50 border-green-500">
                    <CheckCircle2 className="h-5 w-5 text-green-500" />
                    <AlertTitle className="text-green-800 font-medium">Success!</AlertTitle>
                    <AlertDescription className="text-green-700">
                      <div className="space-y-2">
                        <p>{uploadResult.message}</p>
                        {uploadResult.recordsCount && (
                          <p className="font-medium">
                            📋 Processed {uploadResult.recordsCount} attendance records
                          </p>
                        )}
                        {uploadResult.payouts && (
                          <div className="text-sm space-y-1">
                            <p className="font-medium">💰 Payout Calculation Results:</p>
                            <ul className="ml-4 space-y-1">
                              <li>• Created {uploadResult.payouts.created} new payouts</li>
                              <li>• Updated {uploadResult.payouts.updated} existing payouts</li>
                              <li>• Total payouts processed: {uploadResult.payouts.total}</li>
                            </ul>
                          </div>
                        )}
                      </div>
                    </AlertDescription>
                  </Alert>
                ) : (
                  <Alert variant="destructive">
                    <AlertCircle className="h-5 w-5" />
                    <AlertTitle>Error</AlertTitle>
                    <AlertDescription>
                      {uploadResult.error}
                    </AlertDescription>
                  </Alert>
                )}
              </div>
            )}
          </CardContent>
        </Card>
        
        <Card className="lg:col-span-3 shadow-sm">
          <CardHeader className="bg-muted/20 border-b">
            <div className="flex items-center">
              <Info className="h-5 w-5 mr-2 text-primary" />
              <CardTitle>File Format Instructions</CardTitle>
            </div>
            <CardDescription>
              The attendance log file must follow this specific format for successful processing.
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="space-y-6">
              <div>
                <h3 className="text-base font-medium flex items-center mb-2">
                  Format Specification
                </h3>
                <p className="text-sm text-muted-foreground mb-2">
                  Each line should contain the employee ID, date, time, and other optional data separated by spaces or tabs:
                </p>
                <pre className="bg-muted p-3 rounded-md text-sm overflow-x-auto border">
                  &lt;EmployeeID&gt; &lt;YYYY-MM-DD&gt; &lt;HH:MM:SS&gt; [optional data]
                </pre>
              </div>
              
              <div>
                <h3 className="text-base font-medium flex items-center mb-2">
                  Example
                </h3>
                <p className="text-sm text-muted-foreground mb-2">
                  Note: 1, 2, 3 are employee IDs that must match the ID field in employee profiles:
                </p>
                <pre className="bg-muted p-3 rounded-md text-sm overflow-x-auto border">
                  1	2024-01-15	08:30:00	2	0	1	0{'\n'}
                  1	2024-01-15	17:45:00	2	0	1	0{'\n'}
                  2	2024-01-15	09:00:00	2	0	1	0{'\n'}
                  2	2024-01-15	16:35:22	2	0	1	0
                </pre>
              </div>
              
              <div>
                <h3 className="text-base font-medium flex items-center mb-2">
                  <Clock className="h-4 w-4 mr-2" />
                  Processing Logic
                </h3>
                <div className="bg-muted/30 rounded-md p-4 border">
                  <ul className="space-y-2">
                    <li className="flex items-start">
                      <div className="rounded-full bg-primary/10 p-1 mr-2 mt-0.5">
                        <span className="text-xs font-bold text-primary">1</span>
                      </div>
                      <span className="text-sm">The system extracts the first and last record for each employee per day</span>
                    </li>
                    <li className="flex items-start">
                      <div className="rounded-full bg-primary/10 p-1 mr-2 mt-0.5">
                        <span className="text-xs font-bold text-primary">2</span>
                      </div>
                      <span className="text-sm">First record is considered as check-in time</span>
                    </li>
                    <li className="flex items-start">
                      <div className="rounded-full bg-primary/10 p-1 mr-2 mt-0.5">
                        <span className="text-xs font-bold text-primary">3</span>
                      </div>
                      <span className="text-sm">Last record is considered as check-out time</span>
                    </li>
                    <li className="flex items-start">
                      <div className="rounded-full bg-primary/10 p-1 mr-2 mt-0.5">
                        <span className="text-xs font-bold text-primary">4</span>
                      </div>
                      <span className="text-sm">Hours worked are calculated from the difference between check-in and check-out</span>
                    </li>
                    <li className="flex items-start">
                      <div className="rounded-full bg-primary/10 p-1 mr-2 mt-0.5">
                        <span className="text-xs font-bold text-primary">5</span>
                      </div>
                      <span className="text-sm">Payouts are automatically calculated and updated based on attendance data</span>
                    </li>
                  </ul>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
} 