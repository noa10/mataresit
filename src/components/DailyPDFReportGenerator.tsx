import { useState, useEffect } from 'react';
import { DayPicker } from 'react-day-picker';
import { format, startOfMonth, endOfMonth, parseISO, isSameDay } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, Download, CircleDot, Calendar } from 'lucide-react';
import { toast } from '@/components/ui/use-toast';
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import 'react-day-picker/dist/style.css';

// Define a completely custom day component
function CustomDay(props: any) {
  const { date, displayMonth, receiptDates = [], selected, disabled, onSelect } = props;
  const isOutsideMonth = displayMonth && date.getMonth() !== displayMonth.getMonth();
  const hasReceipt = receiptDates.some((d: Date) => isSameDay(d, date));
  const isSelected = selected && isSameDay(date, selected);
  
  // Handle day click
  const handleClick = () => {
    if (!disabled && onSelect) {
      onSelect(date);
    }
  };
  
  return (
    <div 
      onClick={handleClick}
      className={`relative flex flex-col items-center justify-center p-2 cursor-pointer rounded-md
        ${isOutsideMonth ? 'text-muted-foreground/50' : ''}
        ${isSelected ? 'bg-primary text-primary-foreground' : ''}
        ${hasReceipt && !isSelected ? 'hover:bg-primary/10' : ''}
        ${!hasReceipt && !isSelected ? 'hover:bg-muted' : ''}
      `}
    >
      <div>{format(date, 'd')}</div>
      {hasReceipt && !isOutsideMonth && (
        <CircleDot className={`absolute bottom-0 w-3 h-3 ${isSelected ? 'text-primary-foreground' : 'text-primary'}`} />
      )}
    </div>
  );
}

export function DailyPDFReportGenerator() {
  const [selectedDay, setSelectedDay] = useState<Date>();
  const [isLoading, setIsLoading] = useState(false);
  
  // State for tracking the current month displayed in the calendar
  const [currentMonth, setCurrentMonth] = useState<Date>(new Date());
  // State to store dates that have receipts
  const [receiptDates, setReceiptDates] = useState<Date[]>([]);
  // State to track loading of receipt dates
  const [isLoadingDates, setIsLoadingDates] = useState(false);
  // State for report mode: 'payer' or 'category'
  const [reportMode, setReportMode] = useState<'payer' | 'category'>('payer'); // Default mode is 'payer'

  // Function to fetch dates with receipts for the current month
  const fetchReceiptDatesForMonth = async (month: Date) => {
    setIsLoadingDates(true);
    try {
      const startDate = format(startOfMonth(month), 'yyyy-MM-dd');
      const endDate = format(endOfMonth(month), 'yyyy-MM-dd');

      // Get the current user session
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        console.log('No active session found');
        setReceiptDates([]);
        return;
      }

      // Query the receipts table for dates within the current month
      const { data, error } = await supabase
        .from('receipts')
        .select('date')
        .eq('user_id', session.user.id)
        .gte('date', startDate)
        .lte('date', endDate);

      if (error) {
        console.error('Error fetching receipt dates:', error);
        throw error;
      }

      if (data && data.length > 0) {
        // Extract unique dates
        const uniqueDates = [...new Set(data.map(item => item.date))];
        
        // Convert to Date objects
        const dates = uniqueDates
          .map(dateStr => {
            try {
              return parseISO(dateStr);
            } catch (e) {
              console.error(`Error parsing date: ${dateStr}`, e);
              return null;
            }
          })
          .filter((date): date is Date => date !== null);
        
        setReceiptDates(dates);
        console.log('Receipt dates found:', dates.map(d => format(d, 'yyyy-MM-dd')));
      } else {
        console.log('No receipt dates found for the current month');
        setReceiptDates([]);
      }
    } catch (error) {
      console.error('Error in fetchReceiptDatesForMonth:', error);
      setReceiptDates([]);
    } finally {
      setIsLoadingDates(false);
    }
  };

  // Fetch receipt dates when component mounts or month changes
  useEffect(() => {
    fetchReceiptDatesForMonth(currentMonth);
  }, [currentMonth]);

  // Handle day selection
  const handleDaySelect = (day: Date | undefined) => {
    console.log("Day selected:", day);
    setSelectedDay(day);
  };

  const handleModeChange = (value: 'payer' | 'category') => {
    setReportMode(value);
    console.log("Report mode changed to:", value);
  };

  const generatePDF = async () => {
    if (!selectedDay) return;

    try {
      setIsLoading(true);

      // Get the current session for authentication
      const { data: { session } } = await supabase.auth.getSession();

      if (!session) {
        toast({
          title: 'Authentication Error',
          description: 'You must be logged in to generate reports',
          variant: 'destructive'
        });
        return;
      }

      // Use direct URL to the function
      const functionUrl = 'https://mpmkbtsufihzdelrlszs.supabase.co/functions/v1/generate-pdf-report';
      
      // Use fetch directly for binary data
      const dateStr = format(selectedDay, 'yyyy-MM-dd');
      const response = await fetch(functionUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({ date: dateStr, mode: reportMode })
      });

      if (!response.ok) {
        // Try to get error message
        let errorMessage = `Error: ${response.status} ${response.statusText}`;
        try {
          const errorData = await response.json();
          errorMessage = errorData.error || errorMessage;
        } catch {}
        
        throw new Error(errorMessage);
      }

      // Check content type to confirm we got a PDF
      const contentType = response.headers.get('Content-Type');
      if (!contentType || !contentType.includes('application/pdf')) {
        console.warn('Response is not a PDF:', contentType);
        const text = await response.text();
        console.error('Response content:', text);
        throw new Error('Server did not return a PDF file');
      }
      
      // Get PDF as ArrayBuffer
      const pdfData = await response.arrayBuffer();
      console.log(`Received PDF data, size: ${pdfData.byteLength} bytes`);
      
      // Create a Blob from the returned PDF ArrayBuffer data
      const pdfBlob = new Blob([pdfData], { type: 'application/pdf' });
      
      // Create a URL for the blob
      const pdfUrl = URL.createObjectURL(pdfBlob);

      // Create a link element and trigger download
      const link = document.createElement('a');
      link.href = pdfUrl;
      link.download = `expense-report-${dateStr}-${reportMode}-mode.pdf`;
      document.body.appendChild(link);
      link.click();

      // Clean up
      document.body.removeChild(link);
      URL.revokeObjectURL(pdfUrl);

      toast({
        title: 'Success',
        description: 'PDF report generated successfully',
        variant: 'default'
      });
    } catch (error) {
      console.error('Error generating PDF:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to generate PDF report. Please try again.',
        variant: 'destructive'
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="border border-border/40 shadow-sm">
      <CardHeader className="bg-primary/5">
        <CardTitle>Daily Expense Report</CardTitle>
        <p className="text-sm text-muted-foreground">
          Select a day to generate a detailed PDF report of all expenses. 
          Days with a small dot indicator (<CircleDot className="inline-block w-3 h-3 text-primary" />) have recorded receipts.
        </p>
      </CardHeader>
      <CardContent className="flex flex-col items-center gap-4 p-6">
        {isLoadingDates && (
          <p className="text-xs text-muted-foreground text-center mb-2">Loading receipt data...</p>
        )}
        
        {receiptDates.length > 0 && (
          <p className="text-xs text-green-500 text-center mb-2">
            Found {receiptDates.length} days with receipts
          </p>
        )}
        
        <div className="w-full border rounded-lg p-4 shadow-sm">
          <DayPicker
            mode="single"
            selected={selectedDay}
            onSelect={handleDaySelect}
            month={currentMonth}
            onMonthChange={setCurrentMonth}
            components={{
              Day: (props) => CustomDay({ 
                ...props, 
                receiptDates, 
                selected: selectedDay,
                onSelect: handleDaySelect
              })
            }}
            className="mx-auto"
            showOutsideDays={true}
          />
        </div>

        {/* Report Mode Selection */}
        <div className="w-full flex flex-col items-center mt-4">
          <Label htmlFor="report-mode" className="mb-2 text-sm font-medium">
            Report Summary & Statistics Mode:
          </Label>
          <RadioGroup 
            defaultValue="payer" 
            onValueChange={handleModeChange} 
            className="flex items-center space-x-4"
          >
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="payer" id="mode-payer" />
              <Label htmlFor="mode-payer">Payer (Abah/Bakaris)</Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="category" id="mode-category" />
              <Label htmlFor="mode-category">Category</Label>
            </div>
          </RadioGroup>
        </div>

        <Button
          onClick={generatePDF}
          disabled={!selectedDay || isLoading}
          className="w-full mt-4"
          type="button"
        >
          {isLoading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Generating PDF...
            </>
          ) : (
            <>
              <Download className="mr-2 h-4 w-4" />
              Generate PDF Report
            </>
          )}
        </Button>
        {selectedDay && (
          <p className="text-xs text-muted-foreground mt-2 text-center">
            Report for {format(selectedDay, 'MMMM d, yyyy')} using {reportMode} mode summary.
          </p>
        )}
      </CardContent>
    </Card>
  );
}