import { Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

export default function Navbar() {
  const { user } = useAuth();

  return (
    <nav className="bg-background border-b sticky top-0 z-50">
      <div className="container flex items-center justify-between py-4">
        <Link to="/" className="font-bold text-xl">
          ReceiptScan
        </Link>
        
        <div className="flex items-center space-x-4">
          {user ? (
            <>
              <Link to="/dashboard">
                <Button variant="ghost">Dashboard</Button>
              </Link>
              <Link to="/profile">
                <Avatar className="h-8 w-8">
                  <AvatarFallback>{user.email?.charAt(0).toUpperCase() || "U"}</AvatarFallback>
                </Avatar>
              </Link>
            </>
          ) : (
            <>
              <Link to="/auth">
                <Button variant="outline">Login</Button>
              </Link>
              <Link to="/auth">
                <Button>Sign Up</Button>
              </Link>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}
