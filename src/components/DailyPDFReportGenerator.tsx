import { useState, useEffect } from 'react';
import { DayPicker } from 'react-day-picker';
import { format, startOfMonth, endOfMonth, parseISO, isSameDay } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, Download, CircleDot, Calendar } from 'lucide-react';
import { downloadDailyExpenseReport } from '@/lib/export/dailyExpenseReportDownload';

import 'react-day-picker/dist/style.css';

// Define a completely custom day component
interface CustomDayProps {
  date: Date;
  displayMonth?: Date;
  receiptDates?: Date[];
  selected?: Date;
  disabled?: boolean;
  onSelect?: (date: Date) => void;
}

function CustomDay(props: CustomDayProps) {
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
  // State for report mode: only 'category' mode supported
  const [reportMode] = useState<'category'>('category'); // Only category mode

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



  const generatePDF = async () => {
    if (!selectedDay) return;

    await downloadDailyExpenseReport(selectedDay, {
      includeImages: true,
      onLoadingChange: setIsLoading
    });
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
            Report for {format(selectedDay, 'MMMM d, yyyy')} using category summary.
          </p>
        )}
      </CardContent>
    </Card>
  );
}