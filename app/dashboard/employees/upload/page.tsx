'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertCircle, CheckCircle2, Upload, Info, Users, FileSpreadsheet } from 'lucide-react';
import Link from 'next/link';

export default function EmployeeUploadPage() {
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState<{ 
    success?: boolean; 
    message?: string; 
    error?: string;
    createdCount?: number;
    errorCount?: number;
    totalFound?: number;
    results?: Array<{
      success: boolean;
      employee?: any;
      error?: string;
      employeeData?: any;
      details?: string;
    }>;
  } | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setFile(e.target.files[0]);
    }
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
    
    try {
      const formData = new FormData();
      formData.append('file', file);
      
      const response = await fetch('/api/employees/upload-csv', {
        method: 'POST',
        body: formData,
        credentials: 'include',
      });
      
      const data = await response.json();
      
      if (response.ok) {
        setUploadResult({
          success: true,
          message: data.message || 'Employee data processed successfully.',
          createdCount: data.createdCount,
          errorCount: data.errorCount,
          totalFound: data.totalFound,
          results: data.results
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
          error: data.error || 'Failed to process employee data.'
        });
      }
    } catch {
      setUploadResult({
        success: false,
        error: 'An error occurred while uploading the file.'
      });
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8">
        <div>
          <h1 className="text-2xl font-bold">Upload Employee Data</h1>
          <p className="text-muted-foreground mt-1">Upload and process employee information from CSV or Excel files</p>
        </div>
        <div className="mt-4 md:mt-0">
          <Button variant="outline" asChild>
            <Link href="/dashboard/employees">
              View All Employees
            </Link>
          </Button>
        </div>
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-8 mb-12">
        <Card className="lg:col-span-2 shadow-sm">
          <CardHeader className="bg-muted/20 border-b">
            <div className="flex items-center">
              <Upload className="h-5 w-5 mr-2 text-primary" />
              <CardTitle>Upload Employee File</CardTitle>
            </div>
            <CardDescription>
              Upload CSV or Excel file to add multiple employees to the system.
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-6">
            <form onSubmit={handleSubmit}>
              <div className="mb-6">
                <Label htmlFor="file-upload" className="text-base font-medium">Employee Data File</Label>
                <div className="mt-2">
                  <Input
                    id="file-upload"
                    type="file"
                    accept=".csv,.xlsx,.xls"
                    onChange={handleFileChange}
                    className="cursor-pointer"
                  />
                </div>
                <p className="text-sm text-muted-foreground mt-2">
                  Select a .csv, .xlsx, or .xls file containing employee data.
                </p>
              </div>
              
              <Button 
                type="submit" 
                disabled={isUploading || !file}
                className="w-full"
              >
                {isUploading ? 'Processing...' : 'Upload and Process Employees'}
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
                        {uploadResult.totalFound && (
                          <p className="font-medium">
                            👥 Found {uploadResult.totalFound} employees in file
                          </p>
                        )}
                        {uploadResult.createdCount !== undefined && (
                          <div className="text-sm space-y-1">
                            <p className="font-medium">📊 Processing Results:</p>
                            <ul className="ml-4 space-y-1">
                              <li>• Created {uploadResult.createdCount} new employees</li>
                              {(uploadResult.errorCount || 0) > 0 && (
                                <li>• Skipped {uploadResult.errorCount} employees (duplicates or errors)</li>
                              )}
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
              The employee file must follow this specific format for successful processing.
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="space-y-6">
              <div>
                <h3 className="text-base font-medium flex items-center mb-2">
                  <FileSpreadsheet className="h-4 w-4 mr-2" />
                  Required Columns
                </h3>
                <p className="text-sm text-muted-foreground mb-2">
                  Your CSV or Excel file must contain these columns in this exact order:
                </p>
                <div className="bg-muted p-3 rounded-md text-sm border">
                  <div className="grid grid-cols-4 gap-4 font-medium text-foreground mb-2">
                    <div>A: Employee Name</div>
                    <div>B: Device ID</div>
                    <div>C: Daily Rate</div>
                    <div>D: Payment Basis</div>
                  </div>
                </div>
              </div>
              
              <div>
                <h3 className="text-base font-medium flex items-center mb-2">
                  Example
                </h3>
                <p className="text-sm text-muted-foreground mb-2">
                  Sample data rows (the first row should contain headers):
                </p>
                <div className="bg-muted p-3 rounded-md text-sm overflow-x-auto border">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-border">
                        <th className="text-left p-1 font-medium">Employee Name</th>
                        <th className="text-left p-1 font-medium">Device ID</th>
                        <th className="text-left p-1 font-medium">Daily Rate</th>
                        <th className="text-left p-1 font-medium">Payment Basis</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td className="p-1">Hassan Mohamed Hassan</td>
                        <td className="p-1">2</td>
                        <td className="p-1">250</td>
                        <td className="p-1">Monthly</td>
                      </tr>
                      <tr>
                        <td className="p-1">Mustafa Mohamed</td>
                        <td className="p-1">3</td>
                        <td className="p-1">270</td>
                        <td className="p-1">Weekly</td>
                      </tr>
                      <tr>
                        <td className="p-1">Ibrahim Ahmed Abdalaal</td>
                        <td className="p-1">4</td>
                        <td className="p-1">293</td>
                        <td className="p-1">Monthly</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
              
              <div>
                <h3 className="text-base font-medium flex items-center mb-2">
                  <Users className="h-4 w-4 mr-2" />
                  Processing Rules
                </h3>
                <div className="bg-muted/30 rounded-md p-4 border">
                  <ul className="space-y-2">
                    <li className="flex items-start">
                      <div className="rounded-full bg-primary/10 p-1 mr-2 mt-0.5">
                        <span className="text-xs font-bold text-primary">1</span>
                      </div>
                      <span className="text-sm">Employee Name: Full name as it should appear in the system</span>
                    </li>
                    <li className="flex items-start">
                      <div className="rounded-full bg-primary/10 p-1 mr-2 mt-0.5">
                        <span className="text-xs font-bold text-primary">2</span>
                      </div>
                      <span className="text-sm">Device ID: Unique fingerprint device identifier (must be unique)</span>
                    </li>
                    <li className="flex items-start">
                      <div className="rounded-full bg-primary/10 p-1 mr-2 mt-0.5">
                        <span className="text-xs font-bold text-primary">3</span>
                      </div>
                      <span className="text-sm">Daily Rate: Numeric value for daily compensation</span>
                    </li>
                    <li className="flex items-start">
                      <div className="rounded-full bg-primary/10 p-1 mr-2 mt-0.5">
                        <span className="text-xs font-bold text-primary">4</span>
                      </div>
                      <span className="text-sm">Payment Basis: Either &ldquo;Monthly&rdquo; or &ldquo;Weekly&rdquo;</span>
                    </li>
                    <li className="flex items-start">
                      <div className="rounded-full bg-primary/10 p-1 mr-2 mt-0.5">
                        <span className="text-xs font-bold text-primary">5</span>
                      </div>
                      <span className="text-sm">Emails are auto-generated from names; Position defaults to &ldquo;Employee&rdquo;</span>
                    </li>
                    <li className="flex items-start">
                      <div className="rounded-full bg-primary/10 p-1 mr-2 mt-0.5">
                        <span className="text-xs font-bold text-primary">6</span>
                      </div>
                      <span className="text-sm">Duplicate device IDs or emails will be skipped with error reporting</span>
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