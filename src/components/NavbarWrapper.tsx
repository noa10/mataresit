
import { useState } from "react";
import { Menu } from "lucide-react";
import Navbar from "@/components/Navbar";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";

export function NavbarWrapper() {
  const [open, setOpen] = useState(false);
  
  return (
    <div className="relative">
      <Navbar />
      
      {/* Add hamburger menu to top-right corner */}
      <div className="absolute top-4 right-4">
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon">
              <Menu size={20} />
              <span className="sr-only">Menu</span>
            </Button>
          </SheetTrigger>
          <SheetContent>
            <div className="py-6 space-y-6">
              <h3 className="text-lg font-medium">Settings</h3>
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Appearance</p>
                  <p className="text-sm text-muted-foreground">Toggle dark mode</p>
                </div>
                <ThemeToggle />
              </div>
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </div>
  );
}
