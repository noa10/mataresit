import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import { useToast } from "@/hooks/use-toast";
import { adminService } from "@/services/adminService";
import { useAdminTranslation } from "@/contexts/LanguageContext";
import { Eye } from "lucide-react";
import { Link } from "react-router-dom";

export default function ReceiptsManagement() {
  const [receipts, setReceipts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const { toast } = useToast();
  const { t, language } = useAdminTranslation();

  useEffect(() => {
    fetchReceipts();
  }, []);

  const fetchReceipts = async () => {
    try {
      setLoading(true);
      const data = await adminService.getAllReceipts();
      setReceipts(data || []);
    } catch (error: any) {
      toast({
        title: t("receiptsPage.toasts.error"),
        description: error.message || t("receiptsPage.toasts.loadFailed"),
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const filteredReceipts = receipts.filter(receipt => 
    receipt.merchant?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    receipt.profiles?.email?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">{t("receiptsPage.title")}</h1>
        <p className="text-muted-foreground">{t("receiptsPage.description")}</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t("receiptsPage.cardTitle")}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="mb-4">
            <Input
              placeholder={t("receiptsPage.searchPlaceholder")}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="max-w-md"
            />
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Spinner size="lg" />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("receiptsPage.table.date")}</TableHead>
                    <TableHead>{t("receiptsPage.table.merchant")}</TableHead>
                    <TableHead>{t("receiptsPage.table.amount")}</TableHead>
                    <TableHead>{t("receiptsPage.table.user")}</TableHead>
                    <TableHead>{t("receiptsPage.table.status")}</TableHead>
                    <TableHead>{t("receiptsPage.table.actions")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredReceipts.length > 0 ? (
                    filteredReceipts.map((receipt) => (
                      <TableRow key={receipt.id}>
                        <TableCell>
                          {new Date(receipt.date).toLocaleDateString(
                            language === 'ms' ? 'ms-MY' : 'en-MY'
                          )}
                        </TableCell>
                        <TableCell>{receipt.merchant}</TableCell>
                        <TableCell>
                          {typeof receipt.total === 'number'
                            ? `RM ${receipt.total.toFixed(2)}`
                            : 'RM 0.00'}
                        </TableCell>
                        <TableCell>
                          {receipt.profiles?.email || t("receiptsPage.unknownUser")}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={receipt.status === 'reviewed' ? 'default' : 'outline'}
                          >
                            {t(`receiptsPage.statuses.${receipt.status || 'unreviewed'}`, {
                              defaultValue: receipt.status || 'unreviewed',
                            })}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="outline"
                            size="sm"
                            asChild
                          >
                            <Link to={`/receipt/${receipt.id}`}>
                              <Eye className="h-4 w-4 mr-2" />
                              {t("receiptsPage.actions.view")}
                            </Link>
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-4">
                        {t("receiptsPage.noReceipts")}
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
