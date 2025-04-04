
import { useState, useEffect } from "react";
import { Moon, Sun } from "lucide-react";
import { Toggle } from "@/components/ui/toggle";
import { useToast } from "@/components/ui/use-toast";

export function ThemeToggle() {
  const { toast } = useToast();
  const [isDarkMode, setIsDarkMode] = useState(
    document.documentElement.classList.contains('dark')
  );

  // Handle dark mode toggle
  const toggleDarkMode = () => {
    if (isDarkMode) {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    } else {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    }
    
    setIsDarkMode(!isDarkMode);
    
    toast({
      title: `${!isDarkMode ? 'Dark' : 'Light'} mode activated`,
      description: `The application theme has been changed to ${!isDarkMode ? 'dark' : 'light'} mode.`,
      duration: 2000,
    });
  };

  return (
    <Toggle
      pressed={isDarkMode}
      onPressedChange={toggleDarkMode}
      aria-label="Toggle dark mode"
      title={isDarkMode ? "Switch to light mode" : "Switch to dark mode"}
    >
      {isDarkMode ? <Moon size={18} /> : <Sun size={18} />}
    </Toggle>
  );
}
