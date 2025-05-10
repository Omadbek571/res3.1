"use client";

import { useState, useEffect, useMemo } from "react";
import { useQuery, useMutation, useQueryClient, QueryClient, QueryClientProvider } from "@tanstack/react-query";
import axios from "axios";

// Ikonkalar
import { LogOut, Search, ShoppingBag, ShoppingCart, Truck, Users, Minus, Plus as PlusIcon, History, Eye, Edit, Loader2, X, Save, RotateCcw, CheckCircle, Repeat, Printer } from "lucide-react";
// UI Komponentlari
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogClose } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

const API_BASE_URL = "https://oshxonacopy.pythonanywhere.com/api";

export default function POSPageWrapper() {
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: {
      queries: {
        refetchOnWindowFocus: false,
        staleTime: 1 * 60 * 1000, // 1 daqiqa
      },
    },
  }));

  return (
    <QueryClientProvider client={queryClient}>
      <POSPage />
    </QueryClientProvider>
  );
}

function POSPage() {
  const queryClient = useQueryClient();

  // === Asosiy State'lar ===
  const [selectedCategory, setSelectedCategory] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  // === O'ng Panel State'lari ===
  const [editingOrderId, setEditingOrderId] = useState<number | null>(null);
  const [orderToEdit, setOrderToEdit] = useState<any | null>(null);
  const [originalOrderItems, setOriginalOrderItems] = useState<any[]>([]);
  const [isEditLoadingManual, setIsEditLoadingManual] = useState(false);
  const [editErrorManual, setEditErrorManual] = useState<string | null>(null);
  const [submitEditError, setSubmitEditError] = useState<string | null>(null);
  const [cart, setCart] = useState<any[]>([]);

  // === Yangi Buyurtma Uchun Qo'shimcha State'lar ===
  const [orderType, setOrderType] = useState("dine_in");
  const [selectedTableId, setSelectedTableId] = useState<number | null>(null);
  const [customerInfo, setCustomerInfo] = useState({ name: "", phone: "+998 ", address: "" });
  const [showTableDialog, setShowTableDialog] = useState(false);
  const [showCustomerDialog, setShowCustomerDialog] = useState(false);
  const [selectedZoneFilter, setSelectedZoneFilter] = useState('all');

  // === Dialog Oynalari State'lari ===
  const [showLogoutDialog, setShowLogoutDialog] = useState(false);
  const [showHistoryDialog, setShowHistoryDialog] = useState(false);

  // === Buyurtmalar Tarixi State'lari ===
  const [historySearchQuery, setHistorySearchQuery] = useState("");
  const [debouncedHistorySearch, setDebouncedHistorySearch] = useState("");

  // === To'lov uchun State'lar ===
  const [showCheckoutDialog, setShowCheckoutDialog] = useState(false);
  const [tableForCheckout, setTableForCheckout] = useState<any | null>(null);
  const [paymentDetails, setPaymentDetails] = useState({
    method: "cash",
    received_amount: "",
    mobile_provider: "Click"
  });

  // === Chekni alohida olish uchun State ===
  const [isFetchingReceipt, setIsFetchingReceipt] = useState(false);
  const [isFetchingKitchenReceipt, setIsFetchingKitchenReceipt] = useState(false);


  const getToken = () => {
    if (typeof window !== "undefined") { return localStorage.getItem("token"); }
    return null;
  };

  const { data: categories = [], isLoading: isLoadingCategories, error: errorCategories } = useQuery({
    queryKey: ['categories'],
    queryFn: async () => {
      const token = getToken();
      if (!token) throw new Error("Token topilmadi");
      const res = await axios.get(`${API_BASE_URL}/categories/`, { headers: { Authorization: `Bearer ${token}` } });
      return res.data || [];
    },
    onError: (err: any) => toast.error(err.message || "Kategoriyalarni yuklashda xato")
  });

  const { data: products = [], isLoading: isLoadingProducts, error: errorProducts } = useQuery({
    queryKey: ['products'],
    queryFn: async () => {
      const token = getToken();
      if (!token) throw new Error("Token topilmadi");
      const res = await axios.get(`${API_BASE_URL}/products/`, { headers: { Authorization: `Bearer ${token}` } });
      return res.data || [];
    },
    onError: (err: any) => toast.error(err.message || "Mahsulotlarni yuklashda xato")
  });

  const { data: tables = [], isLoading: isLoadingTables, error: errorTables } = useQuery({
    queryKey: ['tables'],
    queryFn: async () => {
      const token = getToken();
      if (!token) throw new Error("Token topilmadi");
      const res = await axios.get(`${API_BASE_URL}/tables/`, { headers: { Authorization: `Bearer ${token}` } });
      return res.data || [];
    },
    refetchInterval: 10000, // Har 10 sekundda
    onError: (err: any) => console.error("Stol xato (RQ):", err.message || "Stollarni yuklashda noma'lum xato")
  });

  useEffect(() => {
    const handler = setTimeout(() => { setDebouncedHistorySearch(historySearchQuery); }, 300);
    return () => clearTimeout(handler);
  }, [historySearchQuery]);

  const { data: orderHistory = [], isLoading: isHistoryLoading, error: historyError, refetch: refetchHistory } = useQuery({
    queryKey: ['orderHistory', debouncedHistorySearch],
    queryFn: async ({ queryKey }) => {
      const [, searchTerm] = queryKey;
      const token = getToken();
      if (!token) throw new Error("Token topilmadi");
      const url = `${API_BASE_URL}/orders/${searchTerm ? `?search=${encodeURIComponent(searchTerm)}` : ''}`;
      const res = await axios.get(url, { headers: { Authorization: `Bearer ${token}` } });
      return res.data || [];
    },
    enabled: showHistoryDialog,
    onError: (err: any) => toast.error(err.message || "Tarixni yuklashda xato")
  });

  const formatDateTime = (d: string | Date | undefined) => {
    if (!d) return "N/A";
    try {
      return new Date(d).toLocaleString('uz-UZ', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
    } catch (e) { return String(d); }
  };

  const handlePrintReceipt = (orderDataForReceipt: any) => {
    if (!orderDataForReceipt || !orderDataForReceipt.id) {
        toast.warn("Chek uchun ma'lumotlar to'liq emas.");
        return;
    }
    try {
        const orderId = orderDataForReceipt.id;
        const orderDate = formatDateTime(orderDataForReceipt.created_at);
        const currentOrderType = orderDataForReceipt.order_type_display || orderDataForReceipt.order_type || orderType;
        let customerDetailsHtml = '';
        if (orderDataForReceipt.order_type === 'dine_in') {
            const tableName = orderDataForReceipt.table_name || (orderDataForReceipt.table ? orderDataForReceipt.table.name : 'Noma\'lum stol');
            customerDetailsHtml = `<p><strong>Stol:</strong> ${tableName}</p>`;
        } else {
            customerDetailsHtml = `
            <p><strong>Mijoz:</strong> ${orderDataForReceipt.customer_name || 'Noma\'lum'}</p>
            <p><strong>Telefon:</strong> ${orderDataForReceipt.customer_phone || 'Noma\'lum'}</p>`;
            if (orderDataForReceipt.order_type === 'delivery') {
            customerDetailsHtml += `<p><strong>Manzil:</strong> ${orderDataForReceipt.customer_address || 'Noma\'lum'}</p>`;
            }
        }

        let itemsHtml = '';
        if (orderDataForReceipt.items && orderDataForReceipt.items.length > 0) {
            orderDataForReceipt.items.forEach((item: any) => {
            const productName = item.product_details?.name || 'Noma\'lum mahsulot';
            const unitPrice = parseFloat(item.unit_price || 0);
            const quantity = item.quantity;
            const totalItemPrice = unitPrice * quantity;
            itemsHtml += `
                <tr>
                <td style="padding: 4px 2px; vertical-align: top;">${productName}</td>
                <td style="text-align: center; padding: 4px 2px; vertical-align: top;">${quantity}</td>
                <td style="text-align: right; padding: 4px 2px; vertical-align: top;">${unitPrice.toLocaleString('uz-UZ')}</td>
                <td style="text-align: right; padding: 4px 2px; vertical-align: top;">${totalItemPrice.toLocaleString('uz-UZ')}</td>
                </tr>`;
            });
        } else {
            itemsHtml = '<tr><td colspan="4" style="text-align:center; padding:10px;">Mahsulotlar topilmadi</td></tr>';
        }

        const subTotalPrice = orderDataForReceipt.items.reduce((sum: number, item: any) => sum + (parseFloat(item.unit_price || 0) * item.quantity), 0);
        let serviceFeeHtml = '';
        if (parseFloat(orderDataForReceipt.service_fee_percent || 0) > 0) {
            const serviceFeeAmount = (subTotalPrice * parseFloat(orderDataForReceipt.service_fee_percent)) / 100;
            serviceFeeHtml = `<p style="text-align: right; margin: 2px 0;">Xizmat haqi (${orderDataForReceipt.service_fee_percent}%): ${serviceFeeAmount.toLocaleString('uz-UZ')} so'm</p>`;
        }
        const finalPrice = parseFloat(orderDataForReceipt.final_price || 0).toLocaleString('uz-UZ');

        const receiptHtml = `
            <html><head><title>Chek #${orderId}</title>
            <style>
            body { font-family: 'Arial', sans-serif; margin: 0; padding: 0; background-color: #fff; }
            .receipt-container { width: 280px; margin: 20px auto; padding: 15px; border: 1px solid #555; background-color: #fff; color: #000; font-size: 11px; }
            .receipt-container h2 { text-align: center; margin: 0 0 10px 0; font-size: 16px; } .receipt-container p { margin: 3px 0; }
            .receipt-container hr { border: none; border-top: 1px dashed #555; margin: 8px 0; }
            .receipt-container table { width: 100%; border-collapse: collapse; margin-top: 5px; }
            .receipt-container th { text-align: left; padding: 4px 2px; border-bottom: 1px solid #555; font-size: 11px; }
            .receipt-container td { padding: 3px 2px; font-size: 10px; } .totals-section p { text-align: right; margin: 2px 0; font-size: 11px; }
            .totals-section .final-total { font-weight: bold; font-size: 13px; margin-top: 5px; border-top: 1px dashed #555; padding-top: 5px;}
            .footer-text { text-align: center; font-size: 9px; margin-top: 15px; }
            @media print {
                body { margin: 0; padding: 0; background-color: #fff !important; -webkit-print-color-adjust: exact; print-color-adjust: exact;}
                .receipt-container { width: 100%; margin: 0; padding: 0; border: none; box-shadow: none; font-size: 10pt; }
                .receipt-container h2 { font-size: 14pt; } .receipt-container p { font-size: 9pt; margin: 2px 0; }
                .receipt-container th { font-size: 9pt; padding: 3px 1px;} .receipt-container td { font-size: 8pt; padding: 2px 1px;}
                .totals-section p { font-size: 9pt;} .totals-section .final-total { font-size: 11pt;} .footer-text { font-size: 8pt; }
            }
            </style></head><body>
            <div class="receipt-container">
            <h2>SmartResto POS</h2> <p style="text-align:center; font-size: 9px;">Oshxona nomi</p><hr>
            <p><strong>Buyurtma ID:</strong> #${orderId}</p><p><strong>Sana:</strong> ${orderDate}</p>
            <p><strong>Turi:</strong> ${currentOrderType}</p>${customerDetailsHtml}<hr>
            <table><thead><tr><th>Mahsulot</th><th style="text-align:center;">Miqdor</th><th style="text-align:right;">Narx</th><th style="text-align:right;">Jami</th></tr></thead>
            <tbody>${itemsHtml}</tbody></table><hr>
            <div class="totals-section"><p>Mahsulotlar: ${subTotalPrice.toLocaleString('uz-UZ')} so'm</p>${serviceFeeHtml}
            <p class="final-total">JAMI TO'LOV: ${finalPrice} so'm</p></div><hr>
            <p class="footer-text">Xaridingiz uchun rahmat!</p>
            <p class="footer-text" style="font-size: 8px;">Chop etildi: ${formatDateTime(new Date().toISOString())}</p>
            </div></body></html>`;

        const printWindow = window.open('', `_blank_customer_${orderId}`, 'width=320,height=500');
        if (printWindow) {
            printWindow.document.write(receiptHtml);
            printWindow.document.close();
            printWindow.focus();
            setTimeout(() => {
            printWindow.print();
            printWindow.onafterprint = () => printWindow.close();
            }, 500);
        } else {
            toast.error("Chekni chiqarish uchun yangi oyna ochilmadi.");
        }
    } catch (error) {
        console.error("Chekni chop etishda xatolik:", error);
        toast.error("Chekni chop etishda kutilmagan xatolik.");
    }
  };

  // OSHXONA CHEKI FUNKSIYASIGA O'ZGARTIRISHLAR
  const handlePrintKitchenReceipt = (orderDataForKitchen: any) => {
    if (!orderDataForKitchen || !orderDataForKitchen.id) {
        toast.warn("Oshxona cheki uchun ma'lumotlar to'liq emas.");
        return;
    }
    try {
        const orderId = orderDataForKitchen.id;
        const orderTime = formatDateTime(orderDataForKitchen.created_at);
        const orderTypeDisplay = orderDataForKitchen.order_type_display || "Noma'lum";
        const tableName = orderDataForKitchen.table_name || (orderDataForKitchen.table ? orderDataForKitchen.table.name : "");
        const waiterName = orderDataForKitchen.created_by ? `${orderDataForKitchen.created_by.first_name || ''} ${orderDataForKitchen.created_by.last_name || ''}`.trim() : "";
        const orderComment = orderDataForKitchen.comment || ""; 

        const isDeltaReceipt = orderDataForKitchen.is_delta_receipt === true; // Yangi flag
        const receiptTitle = isDeltaReceipt ? "BUYURTMAGA QO'SHIMCHA" : "OSHXONA";

        let itemsHtml = '';
        if (orderDataForKitchen.items && orderDataForKitchen.items.length > 0) {
            orderDataForKitchen.items.forEach((item: any) => {
                const productName = item.product_details?.name || 'Noma\'lum mahsulot';
                const quantity = item.quantity;
                // Agar delta chek bo'lsa va item.reason bo'lsa, uni ko'rsatamiz
                const reasonText = isDeltaReceipt && item.reason ? ` <em style="font-size:10px; color: #555;">(${item.reason})</em>` : "";
                itemsHtml += `
                    <tr style="font-size: 14px; font-weight: bold;">
                        <td style="padding: 5px 2px; vertical-align: top; word-break: break-word;">${productName}${reasonText}</td>
                        <td style="text-align: right; padding: 5px 2px; vertical-align: top; font-size: 16px; white-space: nowrap;">${quantity} ta</td>
                    </tr>`;
            });
        } else {
            itemsHtml = '<tr><td colspan="2" style="text-align:center; padding:10px;">Mahsulotlar topilmadi</td></tr>';
        }

        let headerInfo = `<p style="font-size: 16px; font-weight: bold;">Buyurtma #${orderId}</p>`;
        if (orderDataForKitchen.order_type === 'dine_in' && tableName) {
            headerInfo += `<p style="font-size: 18px; font-weight: bold;">Stol: ${tableName}</p>`;
        } else {
            headerInfo += `<p>Turi: ${orderTypeDisplay}</p>`;
        }
        headerInfo += `<p>Vaqt: ${orderTime}</p>`;
        if (waiterName) {
            headerInfo += `<p>Afitsant: ${waiterName}</p>`;
        }

        let footerCommentHtml = "";
        if (orderComment) {
            footerCommentHtml = `<hr><p style="font-weight: bold; font-size: 13px; padding-top: 5px; text-align: center;">IZOH: ${orderComment}</p>`;
        }

        const receiptHtml = `
            <html><head><title>${isDeltaReceipt ? "Qo'shimcha" : "Oshxona"} Cheki #${orderId}</title>
            <style>
              body { font-family: 'Arial', sans-serif; margin: 0; padding: 0; background-color: #fff; }
              .receipt-container { width: 280px; margin: 10px auto; padding: 10px; background-color: #fff; color: #000; font-size: 12px; }
              .receipt-container h2 { text-align: center; margin: 0 0 10px 0; font-size: ${isDeltaReceipt ? '18px' : '20px'}; font-weight: bold; }
              .receipt-container p { margin: 4px 0; line-height: 1.3; } .receipt-container hr { border: none; border-top: 1px dashed #000; margin: 8px 0; }
              .receipt-container table { width: 100%; border-collapse: collapse; margin-top: 5px; }
              @media print { body { margin: 0; padding: 0; background-color: #fff !important; -webkit-print-color-adjust: exact; print-color-adjust: exact;} .receipt-container { width: 100%; margin: 0; padding: 0; border: none; box-shadow: none; } }
            </style></head><body>
            <div class="receipt-container"><h2>${receiptTitle}</h2>${headerInfo}<hr>
            <table><tbody>${itemsHtml}</tbody></table>${footerCommentHtml}<hr>
            <p style="font-size:10px; text-align:center;">Chop etildi: ${formatDateTime(new Date().toISOString())}</p>
            </div></body></html>`;

        const printWindow = window.open('', `_blank_kitchen_${isDeltaReceipt ? 'delta_' : ''}${orderId}`, 'width=300,height=400');
        if (printWindow) {
            printWindow.document.write(receiptHtml);
            printWindow.document.close();
            printWindow.focus();
            setTimeout(() => { printWindow.print(); printWindow.onafterprint = () => printWindow.close(); }, 500);
        } 
    } catch (error) {
        console.error("Oshxona chekini chop etishda xatolik:", error);
        toast.error("Oshxona chekini chop etishda kutilmagan xatolik.");
    }
  };


  const finishEditingInternal = (informUser: boolean = false) => {
    const previousId = editingOrderId;
    setEditingOrderId(null);
    setOrderToEdit(null);
    setOriginalOrderItems([]);
    setIsEditLoadingManual(false);
    setEditErrorManual(null);
    setSubmitEditError(null);
    setCart([]); 
    setSelectedTableId(null);
    setOrderType('dine_in');
    setCustomerInfo({ name: "", phone: "+998 ", address: "" });
    if (informUser && previousId) {
      toast.info(`Buyurtma #${previousId} bilan ishlash yakunlandi/bekor qilindi.`);
    }
  };

  const loadOrderForEditing = async (orderIdToLoad: number, associatedTable: any = null) => {
    const token = getToken();
    if (!token || !orderIdToLoad) { toast.error("Tahrirlash uchun ID/token yetarli emas."); return; }
    const isAnyMutationPending = createOrderMutation.isPending || updateOrderItemsMutation.isPending || checkoutMutation.isPending || reorderMutation.isPending;
    if (isAnyMutationPending) { toast.warn("Iltimos, avvalgi amal tugashini kuting."); return; }
    if (isEditLoadingManual && editingOrderId === orderIdToLoad) { return; }

    setIsEditLoadingManual(true);
    setEditErrorManual(null);
    
    try {
      const data = await queryClient.fetchQuery({
        queryKey: ['orderDetails', orderIdToLoad],
        queryFn: async () => {
          const url = `${API_BASE_URL}/orders/${orderIdToLoad}/`;
          const res = await axios.get(url, { headers: { Authorization: `Bearer ${token}` } });
          if (!res.data) throw new Error(`Buyurtma (#${orderIdToLoad}) ma'lumoti topilmadi.`);
          return res.data;
        },
        staleTime: 0 
      });

      if (data.status === 'paid' || data.status === 'completed' || data.status === 'cancelled') {
        toast.warn(`Buyurtma #${orderIdToLoad} (${data.status_display}) holatida tahrirlab bo'lmaydi.`);
        setIsEditLoadingManual(false);
        setShowHistoryDialog(true);
        return;
      }
      
      setOrderToEdit(data);
      setOriginalOrderItems(JSON.parse(JSON.stringify(data.items || []))); // Original itemlarni saqlab qolamiz
      setEditingOrderId(orderIdToLoad);
      setOrderType(data.order_type || "dine_in");
      setCart([]); 

      if (data.order_type === 'dine_in' && data.table && data.table.id) {
        setSelectedTableId(data.table.id);
      } else if (data.order_type === 'dine_in' && associatedTable && associatedTable.id) {
         setSelectedTableId(associatedTable.id);
      } else {
        setSelectedTableId(null);
      }

      toast.success(`Buyurtma #${orderIdToLoad} tahrirlash uchun yuklandi.`);
      setShowHistoryDialog(false);
      setShowTableDialog(false);

    } catch (err: any) {
      console.error(`Buyurtma (${orderIdToLoad}) tahrirlashga yuklash xato:`, err);
      let errorMsg = `Buyurtma (${orderIdToLoad}) yuklashda xato: ${err.message || 'Noma\'lum server xatosi'}`;
      if (err.response?.data?.detail) errorMsg = err.response.data.detail;
      setEditErrorManual(errorMsg);
      toast.error(errorMsg);
      finishEditingInternal(); 
    } finally {
      setIsEditLoadingManual(false);
    }
  };

  const createOrderMutation = useMutation({
    mutationFn: async (orderData: any) => {
      const token = getToken();
      if (!token) throw new Error("Avtorizatsiya tokeni topilmadi!");
      const dataToSend = { ...orderData };
      if (dataToSend.customer_phone) { dataToSend.customer_phone = dataToSend.customer_phone.replace(/\D/g, ''); }
      const res = await axios.post(`${API_BASE_URL}/orders/`, dataToSend, { headers: { Authorization: `Bearer ${token}` } });
      return res.data;
    },
    onSuccess: (data) => {
      toast.success(`Buyurtma #${data.id} muvaffaqiyatli yaratildi!`);
      if (data && data.items) {
        handlePrintReceipt(data); 
        handlePrintKitchenReceipt(data); // Yangi buyurtma uchun to'liq oshxona cheki
      } else {
        toast.warn("Chek uchun ma'lumotlar to'liq kelmadi.");
      }
      finishEditingInternal(); 
      setShowCustomerDialog(false);
      setShowTableDialog(false);
      queryClient.invalidateQueries({ queryKey: ['tables'] });
      if (showHistoryDialog) { queryClient.invalidateQueries({ queryKey: ['orderHistory'] }); }
    },
    onError: (error: any, variables: any) => {
      console.error("Yangi buyurtma xato:", error.response || error);
      let msg = "Buyurtma yaratishda noma'lum xato!";
      if (error.response?.data) {
        const errorData = error.response.data;
        if (typeof errorData === 'string') msg = errorData;
        else if (errorData.detail) msg = errorData.detail;
        else if (errorData.table_id && Array.isArray(errorData.table_id) && errorData.table_id[0]?.includes('is already occupied')) {
          queryClient.invalidateQueries({ queryKey: ['tables'] });
          const tableNameFromState = tables.find((t: any) => t.id === variables.table_id)?.name;
          msg = `Stol ${tableNameFromState || variables.table_id || "Tanlangan stol"} hozirda band.`;
        } else if (typeof errorData === 'object') {
          msg = Object.entries(errorData).map(([k, v]: [string, any]) => `${k}: ${Array.isArray(v) ? v.join(',') : v}`).join('; ');
        }
      } else if (error.message) { msg = error.message; }
      toast.error(`Xatolik: ${msg}`);
    }
  });

  const updateOrderItemsMutation = useMutation({
    mutationFn: async ({ orderId, payload }: { orderId: number, payload: any }) => {
      const token = getToken();
      if (!token) throw new Error("Avtorizatsiya tokeni topilmadi!");
      const url = `${API_BASE_URL}/orders/${orderId}/update-items/`;
      const res = await axios.post(url, payload, { headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" } });
      return res.data;
    },
    onMutate: () => { setSubmitEditError(null); },
    onSuccess: (data, variables) => {
      toast.success(`Buyurtma #${variables.orderId} muvaffaqiyatli yangilandi!`);
      
      const newItemsFromResponse = data.items || [];
      // originalOrderItems bu yerda shu mutatsiyadan AVVALGI holatni saqlaydi
      const deltaKitchenItems: any[] = [];

      newItemsFromResponse.forEach((newItem: any) => {
        const oldItem = originalOrderItems.find(oi => oi.product === newItem.product);
        if (!oldItem) { // Mahsulot yangi qo'shilgan
          deltaKitchenItems.push({ 
            ...newItem, 
            quantity: newItem.quantity, 
            reason: "Yangi" // Sababini belgilaymiz
          });
        } else if (newItem.quantity > oldItem.quantity) { // Mahsulot miqdori oshgan
          deltaKitchenItems.push({ 
            ...newItem, 
            quantity: newItem.quantity - oldItem.quantity, // Faqat qo'shilgan miqdorni olamiz
            reason: "Qo'shimcha" // Sababini belgilaymiz
          });
        }
        // Agar miqdor kamaygan bo'lsa yoki o'chirilgan bo'lsa,
        // hozircha ularni delta chekka qo'shmaymiz, chunki asosiy muammo qayta pishirish.
        // Agar kerak bo'lsa, bu logikani kengaytirish mumkin.
      });
      
      // Faqat o'zgarishlar bo'lsa (yangi yoki qo'shimcha mahsulotlar) oshxona chekini chiqaramiz
      if (deltaKitchenItems.length > 0) {
        const deltaOrderDataForKitchen = {
          ...data, // Buyurtmaning qolgan ma'lumotlari (ID, stol, vaqt va h.k.)
          items: deltaKitchenItems, // Faqat o'zgargan itemlar
          is_delta_receipt: true // Bu delta chek ekanligini bildiruvchi flag
        };
        handlePrintKitchenReceipt(deltaOrderDataForKitchen);
      } else {
        // Agar faqat izoh o'zgargan bo'lsa yoki mahsulot olib tashlangan/kamaytirilgan bo'lsa,
        // va yangi/qo'shimcha mahsulot bo'lmasa, bu yerga tushadi.
        // Bu holatda "buyurtma yangilandi" degan xabar yetarli bo'lishi mumkin.
        // Yoki "Oshxona uchun o'zgarish yo'q" deb toast chiqarish mumkin.
        const onlyCommentChangedOrItemRemovedOrDecreased = JSON.stringify(originalOrderItems.map(it => ({p:it.product, q:it.quantity})).sort()) !== JSON.stringify(newItemsFromResponse.map(it => ({p:it.product, q:it.quantity})).sort()) || orderToEdit?.comment !== data.comment;

        if (onlyCommentChangedOrItemRemovedOrDecreased && (data.comment && orderToEdit?.comment !== data.comment)) {
             // Agar faqat komment o'zgargan bo'lsa, va hech qanday mahsulot qo'shilmagan/ortmagan bo'lsa,
             // to'liq yangilangan buyurtma bilan (faqat komment uchun) oshxona cheki chiqarish mumkin.
             // Yoki buni alohida kichik "IZOH YANGILANDI" cheki qilish mumkin.
             // Hozircha, agar komment o'zgargan bo'lsa, to'liq chek chiqaramiz, lekin bu chefni chalg'itishi mumkin.
             // Eng yaxshisi, agar deltaKitchenItems bo'sh bo'lsa, faqat toast bilan chegaralanish.
             // toast.info("Faqat izoh o'zgardi yoki mahsulot olib tashlandi/kamaytirildi.");
        }
      }

      // State'ni yangilaymiz
      setOrderToEdit((prev: any) => ({ ...prev, ...data, items: newItemsFromResponse }));
      setOriginalOrderItems(JSON.parse(JSON.stringify(newItemsFromResponse))); // originalOrderItems endi yangi holatga o'tadi

      queryClient.setQueryData(['orderDetails', variables.orderId], data);
      queryClient.invalidateQueries({ queryKey: ['tables'] });
      if (showHistoryDialog) { refetchHistory(); }
    },
    onError: (error: any) => {
        console.error("Buyurtma yangilash xatosi:", error.response || error);
        let errorMsg = "O'zgarishlarni saqlashda xato yuz berdi.";
        if (error.response?.data) {
            const errorData = error.response.data;
            if (typeof errorData === 'string') errorMsg = errorData;
            else if (errorData.detail) errorMsg = errorData.detail;
            else if (typeof errorData === 'object') {
                errorMsg = Object.entries(errorData).map(([k,v]:[string,any]) => `${k}: ${Array.isArray(v) ? v.join(',') : v}`).join('; ')
            }
        }
        else { errorMsg = `Ulanish xatosi: ${error.message}`; }
        setSubmitEditError(errorMsg);
        toast.error(errorMsg, { autoClose: 7000 });
    }
  });

  const checkoutMutation = useMutation({
    mutationFn: async ({ tableId, paymentData }: { tableId: number, paymentData: any }) => {
      const token = getToken();
      if (!token) throw new Error("Avtorizatsiya tokeni topilmadi!");
      const url = `${API_BASE_URL}/tables/${tableId}/checkout/`;
      const res = await axios.post(url, paymentData, { headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" } });
      return res.data;
    },
    onSuccess: (data, variables) => {
      toast.success(`Stol #${variables.tableId} uchun to'lov amalga oshirildi! Buyurtma #${data.id} yopildi.`);
      if (data && data.items) { handlePrintReceipt(data); } 
      setShowCheckoutDialog(false);
      setTableForCheckout(null);
      setPaymentDetails({ method: "cash", received_amount: "", mobile_provider: "Click" });
      queryClient.invalidateQueries({ queryKey: ['tables'] });
      queryClient.invalidateQueries({ queryKey: ['orderHistory'] });
      if (editingOrderId === data.id) { finishEditingInternal(); }
    },
    onError: (error: any, variables) => {
        console.error(`To'lov xatosi (Stol #${variables.tableId}):`, error.response || error);
        let msg = "To'lovni amalga oshirishda xato.";
        if (error.response?.data) {
            const errorData = error.response.data;
            if (typeof errorData === 'string') msg = errorData;
            else if (errorData.detail) msg = errorData.detail;
            else if (typeof errorData === 'object') msg = Object.entries(errorData).map(([k,v]:[string,any])=>`${k}: ${Array.isArray(v)?v.join(','):v}`).join('; ')
        }
        else if (error.message) { msg = error.message; }
        toast.error(`Xatolik: ${msg}`, { autoClose: 7000 });
        if (error.response?.status === 404 || error.response?.data?.detail?.includes("active order")) {
            queryClient.invalidateQueries({ queryKey: ['tables'] });
        }
    }
  });
  
  const reorderMutation = useMutation({
    mutationFn: async (orderData: any) => {
      const token = getToken();
      if (!token) throw new Error("Avtorizatsiya tokeni topilmadi!");
      const dataToSend = { ...orderData };
      if (dataToSend.customer_phone) {
          dataToSend.customer_phone = dataToSend.customer_phone.replace(/\D/g, '');
      }
      const res = await axios.post(`${API_BASE_URL}/orders/`, dataToSend, { headers: { Authorization: `Bearer ${token}` } });
      return res.data;
    },
    onSuccess: (data, variables: any) => {
      toast.success(`Buyurtma #${variables.originalOrderId} dan nusxa (#${data.id}) yaratildi!`);
      if (data && data.items) { 
        handlePrintReceipt(data); 
        handlePrintKitchenReceipt(data); 
      }
      finishEditingInternal(); 
      setShowHistoryDialog(false);
      queryClient.invalidateQueries({ queryKey: ['tables'] });
      queryClient.invalidateQueries({ queryKey: ['orderHistory'] });
    },
    onError: (error: any, variables: any) => {
        console.error("Qayta buyurtma xato:", error.response || error);
        let msg = "Qayta buyurtma berishda noma'lum xato!";
        if (error.response?.data) {
            const errorData = error.response.data;
            if(typeof errorData === 'string') msg=errorData;
            else if(errorData.detail) msg=errorData.detail;
            else if (errorData.table_id && Array.isArray(errorData.table_id) && errorData.table_id[0]?.includes('is already occupied')) {
                 queryClient.invalidateQueries({ queryKey: ['tables'] });
                 const originalOrder = variables.originalOrderData;
                 const tableNameFromState = tables.find((t:any)=>t.id===originalOrder?.table?.id)?.name;
                 const tableName = tableNameFromState || originalOrder?.table_name || originalOrder?.table?.id || "Stol";
                 msg = `Stol ${tableName} hozirda band. Boshqa stol tanlang.`;
             }
            else if(typeof errorData === 'object') msg=Object.entries(errorData).map(([k,v]:[string,any])=>`${k}:${Array.isArray(v)?v.join(','):v}`).join('; ');
        } else if (error.message) { msg = error.message; }
        toast.error(`Xatolik: ${msg}`);
    }
  });

  const filteredProducts = useMemo(() => {
    if (!Array.isArray(products)) return [];
    return products.filter((p: any) =>
      p.is_active &&
      (selectedCategory === null || p.category?.id === selectedCategory) &&
      p.name?.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [products, selectedCategory, searchQuery]);

  const uniqueZones = useMemo(() => {
    if (!Array.isArray(tables)) return ['all'];
    const zones = tables.map((t: any) => t.zone || 'N/A');
    const uniqueSet = new Set(zones);
    const sortedZones = Array.from(uniqueSet).sort((a, b) => {
      if (a === 'N/A') return 1; if (b === 'N/A') return -1;
      const numA = parseInt(a); const numB = parseInt(b);
      if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
      if (!isNaN(numA) && isNaN(numB)) return -1; if (isNaN(numA) && !isNaN(numB)) return 1;
      return a.localeCompare(b);
    });
    return ['all', ...sortedZones];
  }, [tables]);

  const currentPanelItems = useMemo(() => {
    if (editingOrderId && orderToEdit?.items) { return orderToEdit.items; }
    else if (!editingOrderId) { return cart; }
    return [];
  }, [editingOrderId, orderToEdit, cart]);

  const currentPanelTotal = useMemo(() => {
    if (editingOrderId && orderToEdit?.items) {
      return orderToEdit.items.reduce((sum: number, item: any) => sum + (Number(item.unit_price || 0) * item.quantity), 0);
    } else if (!editingOrderId) {
      return cart.reduce((total: number, cartItem: any) => total + (parseFloat(cartItem.product?.price || 0) * cartItem.quantity), 0);
    }
    return 0;
  }, [editingOrderId, orderToEdit, cart]);

  const isMutationLoading = createOrderMutation.isPending || updateOrderItemsMutation.isPending || checkoutMutation.isPending || reorderMutation.isPending;
  const isAnyLoading = isMutationLoading || isLoadingProducts || isLoadingCategories || isEditLoadingManual || isLoadingTables;

  const addToCart = (product: any) => {
    if (editingOrderId) { 
      handleLocalAddItemFromProductList(product);
      return;
    }
    if (!product?.id) { toast.error("Mahsulot qo'shishda xatolik."); return; }
    setCart((prev) => {
      const exist = prev.find((i) => i.id === product.id);
      if (exist) return prev.map((i) => i.id === product.id ? { ...i, quantity: i.quantity + 1 } : i);
      return [...prev, { id: product.id, product: product, quantity: 1 }];
    });
  };

  const decreaseQuantity = (item: any) => {
    if (editingOrderId && orderToEdit) {
      handleLocalEditQuantityChange(item.product, -1); 
      return;
    }
    setCart((prev) => {
      const current = prev.find((i) => i.id === item.id); 
      if (!current) return prev;
      if (current.quantity === 1) return prev.filter((i) => i.id !== item.id);
      return prev.map((i) => i.id === item.id ? { ...i, quantity: Math.max(0, i.quantity - 1) } : i);
    });
  };

  const increaseQuantity = (item: any) => {
    if (editingOrderId && orderToEdit) {
        handleLocalEditQuantityChange(item.product, 1); 
        return;
    }
    setCart((prev) => prev.map((i) => i.id === item.id ? { ...i, quantity: i.quantity + 1 } : i));
  };
  
  const handleLocalEditQuantityChange = (productId: number, change: number) => {
    if (!editingOrderId || !orderToEdit || updateOrderItemsMutation.isPending) return;
    setOrderToEdit((prevOrder: any) => {
      if (!prevOrder) return null;
      const updatedItems = [...prevOrder.items];
      const itemIndex = updatedItems.findIndex(item => item.product === productId);
      if (itemIndex > -1) {
        const currentItem = updatedItems[itemIndex];
        const newQuantity = currentItem.quantity + change;
        if (newQuantity <= 0) { updatedItems.splice(itemIndex, 1); }
        else { updatedItems[itemIndex] = { ...currentItem, quantity: newQuantity }; }
      }
      return { ...prevOrder, items: updatedItems };
    });
  };

  const handleLocalAddItemFromProductList = (product: any) => {
    if (!editingOrderId || !orderToEdit || !product || updateOrderItemsMutation.isPending || isEditLoadingManual) return;
    setOrderToEdit((prevOrder: any) => {
      if (!prevOrder) return null;
      const updatedItems = [...prevOrder.items];
      const itemIndex = updatedItems.findIndex(item => item.product === product.id);
      if (itemIndex > -1) {
        updatedItems[itemIndex] = { ...updatedItems[itemIndex], quantity: updatedItems[itemIndex].quantity + 1 };
      } else {
        updatedItems.push({
          product: product.id,
          product_details: { id: product.id, name: product.name, image_url: product.image },
          quantity: 1,
          unit_price: product.price,
        });
      }
      return { ...prevOrder, items: updatedItems };
    });
  };
  
  const submitOrder = () => {
    if (editingOrderId) return;
    if (cart.length === 0) { toast.warn("Savat bo‘sh!"); return; }
    if (orderType === "dine_in" && !selectedTableId) { toast.warn("Stol tanlang!"); setShowTableDialog(true); return; }
    const phoneDigits = customerInfo.phone.replace(/\D/g, '');
    if ((orderType === "takeaway" || orderType === "delivery") && (!customerInfo.name || phoneDigits.length < 12 )) { 
        setShowCustomerDialog(true); toast.warn("Mijoz ismi va telefon raqamini to'liq kiriting!"); return; 
    }
    if (orderType === "delivery" && !customerInfo.address) { setShowCustomerDialog(true); toast.warn("Yetkazish manzilini kiriting!"); return; }

    const orderData = {
      order_type: orderType,
      table_id: orderType === "dine_in" ? selectedTableId : null,
      customer_name: (orderType === "takeaway" || orderType === "delivery") ? customerInfo.name : null,
      customer_phone: (orderType === "takeaway" || orderType === "delivery") ? customerInfo.phone : null,
      customer_address: orderType === "delivery" ? customerInfo.address : null,
      items: cart.map((item) => ({ product_id: item.id, quantity: item.quantity })),
    };
    createOrderMutation.mutate(orderData);
  };

  const submitEditedOrderChanges = () => {
    if (!editingOrderId || !orderToEdit || !originalOrderItems || updateOrderItemsMutation.isPending || isEditLoadingManual) {
      toast.warn("O'zgarishlarni saqlash mumkin emas."); return;
    }
    if (orderToEdit.status === 'paid' || orderToEdit.status === 'completed' || orderToEdit.status === 'cancelled') {
        toast.warn(`Buyurtma #${editingOrderId} (${orderToEdit.status_display}) holatida, o'zgartirib bo'lmaydi.`); return;
    }
    
    const currentItems = orderToEdit.items || [];
    const operations: any[] = [];
    currentItems.forEach((currentItem: any) => {
      const originalItem = originalOrderItems.find(o => o.product === currentItem.product);
      if (!originalItem) { 
        operations.push({ operation: "add", product_id: currentItem.product, quantity: currentItem.quantity });
      } else if (currentItem.quantity !== originalItem.quantity) {
        if (originalItem.id && typeof originalItem.id === 'number') {
          operations.push({ operation: "set", order_item_id: originalItem.id, quantity: currentItem.quantity });
        } else { console.warn("Set operatsiyasi uchun originalItem.id topilmadi:", originalItem); }
      }
    });
    originalOrderItems.forEach((originalItem: any) => {
      if (!currentItems.find((c: any) => c.product === originalItem.product)) {
        if (originalItem.id && typeof originalItem.id === 'number') { 
          operations.push({ operation: "remove", order_item_id: originalItem.id });
        } else { console.warn("Remove operatsiyasi uchun originalItem.id topilmadi:", originalItem); }
      }
    });

    if (operations.length === 0) { toast.info("Hech qanday o'zgarish qilinmadi."); return; }
    updateOrderItemsMutation.mutate({ orderId: editingOrderId, payload: { items_operations: operations } });
  };
  
  const reorderToSameTable = (order: any) => {
    if (isAnyLoading) { toast.warn("Boshqa amal bajarilmoqda..."); return; }
    if (order.status !== "completed" && order.status !== "paid") { 
        toast.warn("Bu funksiya faqat yakunlangan buyurtmalar uchun."); return; 
    }
    const tableIdForReorder = order.order_type === "dine_in" ? (order.table?.id || order.table_id) : null;
    if (order.order_type === "dine_in" && !tableIdForReorder) {
        toast.error("Stol ma'lumotlari topilmadi."); return; 
    }
    const orderData = {
      order_type: order.order_type,
      table_id: tableIdForReorder,
      customer_name: (order.order_type === "takeaway" || order.order_type === "delivery") ? order.customer_name : null,
      customer_phone: (order.order_type === "takeaway" || order.order_type === "delivery") ? order.customer_phone : null,
      customer_address: order.order_type === "delivery" ? order.customer_address : null,
      items: order.items.map((item: any) => ({ product_id: item.product, quantity: item.quantity })),
    };
    reorderMutation.mutate({ ...orderData, originalOrderId: order.id, originalOrderData: order });
  };

  const handleCustomerInfoSave = () => {
    const phoneDigits = customerInfo.phone.replace(/\D/g, '');
    if (!customerInfo.name || phoneDigits.length < 12 ) { toast.warn("Ism va raqamni to'liq kiriting!"); return; }
    if (orderType === "delivery" && !customerInfo.address) { toast.warn("Manzilni kiriting!"); return; }
    setShowCustomerDialog(false); toast.info("Mijoz ma'lumotlari kiritildi.");
  };

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const prefix = "+998 ";
    let newValue = e.target.value;
    if (!newValue.startsWith(prefix)) { newValue = prefix; }
    const numberPart = newValue.substring(prefix.length).replace(/\D/g, '').substring(0, 9);
    newValue = prefix + numberPart;
    setCustomerInfo(prev => ({ ...prev, phone: newValue }));
  };
  
  const cancelEditing = () => {
    if (updateOrderItemsMutation.isPending) { toast.warn("Saqlash jarayoni ketmoqda..."); return; }
    finishEditingInternal(true);
  };

  const handleLogout = () => {
    if (typeof window !== "undefined") { localStorage.removeItem("token"); window.location.href = "/auth"; toast.info("Tizimdan chiqildi"); }
  };

  const fetchAndPrintCurrentOrderReceipt = async (type: 'customer' | 'kitchen' = 'customer') => {
    if (!editingOrderId || (type === 'customer' && isFetchingReceipt) || (type === 'kitchen' && isFetchingKitchenReceipt) ) return;
    
    if (type === 'customer') setIsFetchingReceipt(true);
    if (type === 'kitchen') setIsFetchingKitchenReceipt(true);

    try {
      const token = getToken();
      if (!token) throw new Error("Token topilmadi");
      const res = await axios.get(`${API_BASE_URL}/orders/${editingOrderId}/`, { headers: { Authorization: `Bearer ${token}` } });
      
      if (type === 'customer') {
        handlePrintReceipt(res.data);
      } else {
        // Hozirgi buyurtma uchun oshxona chekini chiqarganda to'liq chek chiqadi.
        // Faqat yangilanish (update) paytida delta chek kerak.
        handlePrintKitchenReceipt(res.data); 
      }
    } catch (err: any) {
      console.error(`Joriy ${type} chekini olishda xatolik:`, err);
      toast.error(err.message || `Joriy ${type} chek ma'lumotlarini olishda xatolik.`);
    } finally {
      if (type === 'customer') setIsFetchingReceipt(false);
      if (type === 'kitchen') setIsFetchingKitchenReceipt(false);
    }
  };

  // === JSX ===
  return (
    <TooltipProvider>
      <div className="flex h-screen flex-col bg-muted/40">
        <ToastContainer position="bottom-right" autoClose={4000} theme="colored" />
        
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b bg-background px-4 sm:px-6 shrink-0">
          <div className="flex items-center gap-2 sm:gap-4">
            <Tooltip><TooltipTrigger asChild>
              <Button variant="outline" size="icon" className="shrink-0" onClick={() => setShowLogoutDialog(true)}><LogOut className="h-5 w-5" /></Button>
            </TooltipTrigger><TooltipContent><p>Chiqish</p></TooltipContent></Tooltip>
            <Tooltip><TooltipTrigger asChild>
              <Button variant="outline" size="icon" className="shrink-0" onClick={() => { setHistorySearchQuery(''); setDebouncedHistorySearch(''); setShowHistoryDialog(true); if(showHistoryDialog) refetchHistory(); }}>
                <History className="h-5 w-5" />
              </Button>
            </TooltipTrigger><TooltipContent><p>Buyurtmalar Tarixi</p></TooltipContent></Tooltip>
            <h1 className="text-lg sm:text-xl font-bold hidden md:inline-block">SmartResto POS</h1>
          </div>
          <div className="flex-1 flex justify-center px-4">
            <Tabs
              value={editingOrderId ? (orderToEdit?.order_type || 'dine_in') : orderType}
              onValueChange={(value) => {
                if (editingOrderId || isMutationLoading) return;
                if (orderType !== value) {
                    setOrderType(value);
                    setSelectedTableId(null);
                    setCustomerInfo({ name: "", phone: "+998 ", address: "" });
                    setCart([]); 
                    toast.info(`Buyurtma turi "${value === 'dine_in' ? 'Shu yerda' : value === 'takeaway' ? 'Olib ketish' : 'Yetkazish'}" ga o'zgartirildi.`);
                }
              }}
              className={`w-full max-w-md ${editingOrderId || isMutationLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              <TabsList className="grid w-full grid-cols-3 h-11">
                <TabsTrigger value="dine_in" disabled={!!editingOrderId || isMutationLoading} className="flex items-center gap-1">
                  <Users className="h-4 w-4" /> <span className="hidden sm:inline">Shu yerda</span><span className="sm:hidden">Ichki</span>
                </TabsTrigger>
                <TabsTrigger value="takeaway" disabled={!!editingOrderId || isMutationLoading} className="flex items-center gap-1">
                  <ShoppingBag className="h-4 w-4" /> <span className="hidden sm:inline">Olib ketish</span><span className="sm:hidden">Olib k.</span>
                </TabsTrigger>
                <TabsTrigger value="delivery" disabled={!!editingOrderId || isMutationLoading} className="flex items-center gap-1">
                  <Truck className="h-4 w-4" /> <span className="hidden sm:inline">Yetkazish</span><span className="sm:hidden">Yetkaz.</span>
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
          <div className="flex items-center gap-2 sm:gap-4"> {/* O'ng taraf uchun bo'sh joy */} </div>
        </header>

        <div className="flex-1 grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-0 overflow-hidden">
          <div className="md:col-span-2 lg:col-span-3 flex flex-col border-r border-border overflow-hidden">
            <div className="border-b border-border p-4 shrink-0">
              <div className="relative mb-4">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input type="search" placeholder="Mahsulot qidirish..." className="w-full rounded-lg bg-background pl-8" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
              </div>
              <ScrollArea className="w-full">
                <div className="flex space-x-2 pb-2">
                  <Button size="sm" variant={selectedCategory === null ? "default" : "outline"} className="rounded-full px-4" onClick={() => setSelectedCategory(null)}>Barchasi</Button>
                  {isLoadingCategories ? <div className="p-2"><Loader2 className="h-4 w-4 animate-spin" /></div> : errorCategories ? <p className="p-2 text-xs text-destructive">Kategoriya xato</p> :
                    Array.isArray(categories) && categories.map((cat: any) => (
                      <Button size="sm" key={cat.id} variant={selectedCategory === cat.id ? "default" : "outline"} className="rounded-full px-4" onClick={() => setSelectedCategory(cat.id)}>{cat.name}</Button>
                  ))}
                </div><ScrollBar orientation="horizontal" />
              </ScrollArea>
            </div>
            <ScrollArea className="flex-1 p-4">
              {isLoadingProducts ? <div className="flex h-full items-center justify-center"><Loader2 className="h-8 w-8 animate-spin" /><p className="ml-2">Yuklanmoqda...</p></div> :
               errorProducts ? <div className="text-destructive p-4 text-center">Mahsulotlarni yuklashda xatolik. <Button variant="link" onClick={() => queryClient.refetchQueries({queryKey: ['products']})}>Qayta urinish</Button></div> :
               filteredProducts.length === 0 ? <div className="text-muted-foreground text-center p-10">Mahsulot topilmadi.</div> :
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
                  {filteredProducts.map((product: any) => (
                    <Card key={product.id} 
                        className={`cursor-pointer group overflow-hidden ${isAnyLoading && (!editingOrderId || (editingOrderId && updateOrderItemsMutation.isPending)) ? 'opacity-60 pointer-events-none' : ''}`}
                        onClick={() => { 
                            if (isAnyLoading && (!editingOrderId || (editingOrderId && updateOrderItemsMutation.isPending))) return;
                            addToCart(product);
                        }}>
                      <CardContent className="p-0 flex flex-col">
                        <div className="aspect-square w-full overflow-hidden"><img src={product.image || "/placeholder-product.jpg"} alt={product.name} className="w-full h-full object-cover transition-transform group-hover:scale-105" onError={(e) => { (e.target as HTMLImageElement).src = "/placeholder-product.jpg"; }} loading="lazy" /></div>
                        <div className="p-3"><h3 className="font-semibold text-sm line-clamp-2">{product.name}</h3><p className="text-xs font-semibold text-primary mt-1">{Number(product.price).toLocaleString('uz-UZ')} so‘m</p></div>
                      </CardContent>
                    </Card>
                  ))}
              </div>}
            </ScrollArea>
          </div>

          <div className="md:col-span-1 lg:col-span-2 flex flex-col bg-background overflow-hidden">
            <div className="flex items-center justify-between border-b border-border p-4 shrink-0 h-16">
              <div className="flex items-center space-x-2">
                {isEditLoadingManual ? <Loader2 className="h-5 w-5 animate-spin" /> : editingOrderId ? <Edit className="h-5 w-5 text-primary" /> : <ShoppingCart className="h-5 w-5" />}
                <h2 className="text-lg font-medium">{isEditLoadingManual ? "Yuklanmoqda..." : editingOrderId ? `Tahrirlash #${editingOrderId}` : "Yangi Buyurtma"}</h2>
              </div>
              <div className="flex items-center gap-1"> 
                {editingOrderId && orderToEdit ? (
                  <>
                    {orderToEdit.table && <Badge variant="outline" className="hidden sm:inline-flex text-xs px-1.5 py-0.5">Stol {orderToEdit.table.name}</Badge>}
                    <Tooltip><TooltipTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => fetchAndPrintCurrentOrderReceipt('customer')} disabled={isFetchingReceipt || isAnyLoading}><Printer className="h-4 w-4" /></Button></TooltipTrigger><TooltipContent><p>Mijoz Cheki</p></TooltipContent></Tooltip>
                    <Tooltip><TooltipTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => fetchAndPrintCurrentOrderReceipt('kitchen')} disabled={isFetchingKitchenReceipt || isAnyLoading}><Printer className="h-4 w-4 text-orange-500" /></Button></TooltipTrigger><TooltipContent><p>Oshxona Cheki (To'liq)</p></TooltipContent></Tooltip>
                    <Tooltip><TooltipTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8" onClick={cancelEditing} disabled={isAnyLoading}><X className="h-5 w-5 text-destructive" /></Button></TooltipTrigger><TooltipContent><p>Bekor qilish</p></TooltipContent></Tooltip>
                  </>
                ) : !editingOrderId ? (
                  <>
                    {orderType === "dine_in" && (
                      <>
                        {selectedTableId && tables.find((t: any) => t.id === selectedTableId) && <Badge variant="outline" className="text-xs px-1.5 py-0.5">Stol {tables.find((t: any) => t.id === selectedTableId)?.name}</Badge>}
                        {/* STOL TUGMASI O'ZGARTIRILDI */}
                        <Button variant="outline" className="h-10 text-sm px-3" onClick={() => setShowTableDialog(true)} disabled={isAnyLoading}>
                          {selectedTableId ? "Stol O'zg." : "Stol Tanlash"}
                        </Button>
                      </>
                    )}
                    {(orderType === 'takeaway' || orderType === 'delivery') && (
                        customerInfo.name ? 
                        <Tooltip><TooltipTrigger asChild><Badge variant="secondary" className="cursor-pointer text-xs px-1.5 py-0.5 h-10 flex items-center" onClick={() => setShowCustomerDialog(true)}>{customerInfo.name.split(' ')[0]}</Badge></TooltipTrigger><TooltipContent><p>{customerInfo.name}, {customerInfo.phone}</p></TooltipContent></Tooltip> :
                        <Button variant="outline" className="h-10 text-sm px-3" onClick={() => setShowCustomerDialog(true)} disabled={isAnyLoading}>Mijoz</Button>
                    )}
                  </>
                ) : null}
              </div>
            </div>
            <ScrollArea className="flex-1 p-4">
              {isEditLoadingManual ? <div className="flex h-full items-center justify-center"><Loader2 className="h-6 w-6 animate-spin mr-2" /> Buyurtma yuklanmoqda...</div> :
               editErrorManual ? <div className="text-destructive p-4 text-center">{editErrorManual} <Button variant="link" onClick={() => editingOrderId && loadOrderForEditing(editingOrderId)}>Qayta urinish</Button></div> :
               currentPanelItems.length === 0 ? <div className="text-muted-foreground text-center p-10"><ShoppingCart className="mx-auto h-12 w-12 mb-2" />{editingOrderId ? "Buyurtmada mahsulot yo'q" : "Savat bo'sh"}</div> :
                <div className="space-y-3">
                  {currentPanelItems.map((item: any, index: number) => {
                    const productInfo = editingOrderId ? item.product_details : item.product;
                    const productName = productInfo?.name || `Noma'lum ID: ${editingOrderId ? item.product : item.id}`;
                    const productImage = editingOrderId ? productInfo?.image_url : productInfo?.image;
                    const unitPrice = editingOrderId ? item.unit_price : productInfo?.price;
                    const itemKey = editingOrderId ? (item.id || `temp-${item.product}-${index}`) : item.id;
                    return (
                      <div key={itemKey} className={`flex items-center justify-between space-x-2 border-b pb-3 last:border-b-0 ${isAnyLoading && editingOrderId && updateOrderItemsMutation.isPending ? 'opacity-70' : ''}`}>
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          <img src={productImage || "/placeholder-product.jpg"} alt={productName} className="h-10 w-10 rounded-md object-cover shrink-0" onError={(e) => { (e.target as HTMLImageElement).src = "/placeholder-product.jpg"; }} />
                          <div className="flex-1 min-w-0"><h3 className="font-medium text-sm truncate" title={productName}>{productName}</h3><p className="text-xs text-muted-foreground">{Number(unitPrice || 0).toLocaleString('uz-UZ')} so‘m</p></div>
                        </div>
                        <div className="flex items-center space-x-1 shrink-0">
                          <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => decreaseQuantity(item)} disabled={isAnyLoading && editingOrderId && updateOrderItemsMutation.isPending}><Minus className="h-3.5 w-3.5" /></Button>
                          <span className="w-6 text-center text-sm">{item.quantity}</span>
                          <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => increaseQuantity(item)} disabled={isAnyLoading && editingOrderId && updateOrderItemsMutation.isPending}><PlusIcon className="h-3.5 w-3.5" /></Button>
                        </div>
                        <div className="text-right shrink-0 w-24"><p className="font-semibold text-sm">{(Number(unitPrice || 0) * item.quantity).toLocaleString('uz-UZ')} so‘m</p></div>
                      </div>
                    );
                  })}
              </div>}
              {submitEditError && <p className="text-center text-destructive text-xs mt-4 p-2 bg-destructive/10 rounded">{submitEditError}</p>}
            </ScrollArea>
            <div className="border-t border-border p-4 shrink-0 bg-muted/20">
              <div className="space-y-1 mb-4 text-sm">
                <div className="flex justify-between"><span className="text-muted-foreground">Jami (mahsulot):</span><span className="font-semibold">{currentPanelTotal.toLocaleString('uz-UZ')} so‘m</span></div>
                {editingOrderId && orderToEdit && (
                  <>
                    <div className="flex justify-between"><span className="text-muted-foreground">Holati:</span><Badge variant={orderToEdit.status === 'completed' || orderToEdit.status === 'paid' ? 'success' : orderToEdit.status === 'cancelled' ? 'destructive' : 'secondary'} className="capitalize">{orderToEdit.status_display || orderToEdit.status}</Badge></div>
                    {Number(orderToEdit.service_fee_percent || 0) > 0 && <div className="flex justify-between text-xs"><span className="text-muted-foreground">Xizmat ({orderToEdit.service_fee_percent}%):</span><span>{((currentPanelTotal * Number(orderToEdit.service_fee_percent))/100).toLocaleString('uz-UZ')} so'm</span></div>}
                    <div className="flex justify-between font-semibold border-t pt-1 mt-1"><span className="text-muted-foreground">Yakuniy Narx:</span><span>{Number(orderToEdit.final_price || currentPanelTotal).toLocaleString('uz-UZ')} so‘m</span></div>
                  </>
                )}
              </div>
              {editingOrderId && orderToEdit ? (
                <div className="space-y-2">
                  <Button className="w-full h-12" size="lg" onClick={submitEditedOrderChanges} disabled={isAnyLoading || currentPanelItems.length === 0 || !!editErrorManual || ['paid', 'completed', 'cancelled'].includes(orderToEdit.status)} >
                    {updateOrderItemsMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />} Saqlash
                  </Button>
                  {orderToEdit.order_type === 'dine_in' && orderToEdit.table &&
                   !tables.find((t:any) => t.id === orderToEdit.table.id)?.is_available &&
                   tables.find((t:any) => t.id === orderToEdit.table.id)?.active_order_id === editingOrderId &&
                   !['paid', 'completed', 'cancelled'].includes(orderToEdit.status) && true 
                   && (
                    <Button variant="success" className="w-full h-12" size="lg" onClick={() => { const currentTable = tables.find((t:any) => t.id === orderToEdit.table.id); setTableForCheckout(currentTable); setShowCheckoutDialog(true); }} disabled={isAnyLoading}>
                      <CheckCircle className="mr-2 h-4 w-4" /> To'lov ({Number(orderToEdit.final_price || 0).toLocaleString('uz-UZ')} so‘m)
                    </Button>
                  )}
                </div>
              ) : (
                <Button className="w-full h-12" size="lg" onClick={submitOrder} disabled={isAnyLoading || cart.length === 0 || (orderType === 'dine_in' && !selectedTableId) || ((orderType === 'takeaway' || orderType === 'delivery') && (!customerInfo.name || customerInfo.phone.replace(/\D/g, '').length < 12)) || (orderType === 'delivery' && !customerInfo.address)}>
                  {createOrderMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null} Buyurtma ({currentPanelTotal.toLocaleString('uz-UZ')} so‘m)
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* Stol Tanlash Dialogi */}
        <Dialog open={showTableDialog} onOpenChange={setShowTableDialog}>
          <DialogContent className="sm:max-w-lg md:max-w-2xl lg:max-w-4xl">
            <DialogHeader><DialogTitle>Stol tanlash</DialogTitle><DialogDescription>Buyurtma uchun stol tanlang yoki band stolni oching.</DialogDescription></DialogHeader>
            <div className="my-4 flex items-center gap-4 px-6">
              <Label htmlFor="zone-filter" className="shrink-0">Zona:</Label>
              <Select value={selectedZoneFilter} onValueChange={setSelectedZoneFilter}><SelectTrigger id="zone-filter" className="w-full sm:w-[200px]"><SelectValue /></SelectTrigger>
                <SelectContent>{uniqueZones.map(zone => (<SelectItem key={zone} value={zone}>{zone === 'all' ? 'Barchasi' : zone}</SelectItem>))}</SelectContent>
              </Select>
            </div>
            <div className="px-6 pb-4 min-h-[300px]">
              {isLoadingTables && !tables.length ? <div className="flex justify-center items-center h-40"><Loader2 className="h-6 w-6 animate-spin" /></div> :
               errorTables ? <div className="text-destructive p-4 text-center">Stollarni yuklashda xatolik. <Button variant="link" onClick={() => queryClient.refetchQueries({queryKey: ['tables']})}>Qayta</Button></div> :
               !tables.filter((t:any) => selectedZoneFilter === 'all' || (t.zone || 'N/A') === selectedZoneFilter).length ? <p className="text-center text-muted-foreground py-10">Bu zonada stol topilmadi.</p> :
                <ScrollArea className="max-h-[60vh] pr-3"><div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-3">
                  {tables.filter((t:any) => selectedZoneFilter === 'all' || (t.zone || 'N/A') === selectedZoneFilter)
                    .sort((a:any, b:any) => (parseInt(a.name.replace(/\D/g,'')) || a.name) > (parseInt(b.name.replace(/\D/g,'')) || b.name) ? 1 : -1)
                    .map((table: any) => (
                    <div key={table.id} className="flex flex-col items-stretch">
                        <Button 
                          variant="outline"
                          className={`w-full h-auto min-h-[80px] flex flex-col justify-center items-center p-2 border-2 whitespace-normal text-center mb-1
                            ${!table.is_available ? "bg-red-100 border-red-400 text-red-700 hover:bg-red-200 dark:bg-red-900/30 dark:border-red-700 dark:text-red-300 dark:hover:bg-red-800/40"
                            : selectedTableId === table.id && !editingOrderId ? "bg-blue-600 border-blue-700 text-white hover:bg-blue-700"
                            : "bg-green-100 border-green-400 hover:bg-green-200 dark:bg-green-900/30 dark:border-green-700 dark:hover:bg-green-800/40"}`}
                          onClick={() => {
                            if (isAnyLoading) return;
                            if (!table.is_available) {
                              if (table.active_order_id) {
                                if (editingOrderId === table.active_order_id) { setShowTableDialog(false); return; }
                                finishEditingInternal(); 
                                loadOrderForEditing(table.active_order_id, table);
                              } else { toast.warn(`Stol ${table.name} band, lekin aktiv buyurtmasi yo'q.`); queryClient.invalidateQueries({ queryKey: ['tables'] }); }
                            } else { 
                              if (editingOrderId) { 
                                finishEditingInternal(true);
                              }
                              if (orderType !== 'dine_in') {
                                  setOrderType('dine_in');
                                  setCart([]); 
                              }
                              setSelectedTableId(table.id);
                              setCustomerInfo({ name: "", phone: "+998 ", address: "" });
                              setShowTableDialog(false);
                              toast.success(`Stol ${table.name} tanlandi.`);
                            }
                          }} disabled={isAnyLoading}>
                          <div className="font-semibold text-base leading-tight">{table.name}</div>
                          <div className={`text-xs mt-0.5 font-medium ${!table.is_available ? '' : 'text-green-700 dark:text-green-400'}`}>{table.is_available ? "Bo‘sh" : "Band"}</div>
                          {table.zone && table.zone !== 'N/A' && <div className="text-[10px] text-muted-foreground">({table.zone})</div>}
                          {!table.is_available && table.active_order_id && (
                            <div className="text-[10px] mt-0.5 text-blue-600 dark:text-blue-400">
                              ID: #{table.active_order_id} <br />
                              {parseFloat(table.active_order_final_price || "0") > 0 && <span>{parseFloat(table.active_order_final_price).toLocaleString('uz-UZ')} so'm</span>}
                            </div>
                          )}
                        </Button>
                        {!table.is_available && table.active_order_id && true 
                        && (
                          <Button
                            variant="destructive" size="xs" className="w-full text-[10px] px-1 py-0.5 h-auto"
                            onClick={() => { setTableForCheckout(table); setShowCheckoutDialog(true); }}
                            disabled={isAnyLoading} > To'lash </Button>
                        )}
                    </div>
                  ))}
                </div></ScrollArea>}
            </div>
            <DialogFooter className="px-6 pb-6"><DialogClose asChild><Button variant="ghost">Yopish</Button></DialogClose></DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={showCustomerDialog} onOpenChange={setShowCustomerDialog}>
          <DialogContent className="sm:max-w-md"><DialogHeader><DialogTitle>{orderType === "delivery" ? "Yetkazish ma‘lumotlari" : "Mijoz ma‘lumotlari"}</DialogTitle></DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="space-y-1"><Label htmlFor="cust-name">Ism*</Label><Input id="cust-name" value={customerInfo.name} onChange={(e) => setCustomerInfo(p=>({...p, name: e.target.value}))} /></div>
              <div className="space-y-1"><Label htmlFor="cust-phone">Telefon*</Label><Input id="cust-phone" type="tel" value={customerInfo.phone} onChange={handlePhoneChange} maxLength={17}/></div>
              {orderType === "delivery" && <div className="space-y-1"><Label htmlFor="cust-addr">Manzil*</Label><Input id="cust-addr" value={customerInfo.address} onChange={(e) => setCustomerInfo(p=>({...p, address: e.target.value}))} /></div>}
            </div>
            <DialogFooter><DialogClose asChild><Button variant="outline">Bekor</Button></DialogClose><Button onClick={handleCustomerInfoSave}>Saqlash</Button></DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={showLogoutDialog} onOpenChange={setShowLogoutDialog}>
          <DialogContent className="sm:max-w-[400px]"><DialogHeader><DialogTitle>Chiqish</DialogTitle><DialogDescription>Tizimdan chiqmoqchimisiz?</DialogDescription></DialogHeader>
          <DialogFooter className="mt-4"><DialogClose asChild><Button variant="outline">Yo'q</Button></DialogClose><Button variant="destructive" onClick={handleLogout}>Ha, Chiqish</Button></DialogFooter></DialogContent>
        </Dialog>

        <Dialog open={showHistoryDialog} onOpenChange={setShowHistoryDialog}>
          <DialogContent className="sm:max-w-xl md:max-w-3xl lg:max-w-5xl xl:max-w-7xl h-[90vh] flex flex-col">
            <DialogHeader><DialogTitle>Buyurtmalar Tarixi</DialogTitle><DialogDescription>Tahrirlash uchun ustiga bosing (yakunlangan/bekor qilinganlarni tahrirlab bo'lmaydi).</DialogDescription></DialogHeader>
            <div className="px-6 py-2"><div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input type="search" placeholder="ID, mijoz, tel, stol bo'yicha qidirish..." className="w-full pl-8" value={historySearchQuery} onChange={(e) => setHistorySearchQuery(e.target.value)} />
            </div></div>
            <div className="flex-1 overflow-hidden px-1"><ScrollArea className="h-full px-5 pb-6">
              {isHistoryLoading ? <div className="flex h-full items-center justify-center"><Loader2 className="h-6 w-6 animate-spin mr-2" /> Yuklanmoqda...</div> :
               historyError ? <div className="text-destructive p-4 text-center">Tarix yuklashda xatolik.</div> :
               orderHistory.length === 0 ? <div className="text-muted-foreground text-center p-10">{historySearchQuery ? `"${historySearchQuery}" uchun topilmadi.` : "Tarix bo'sh."}</div> :
                <div className="space-y-4">
                  {[...orderHistory].sort((a:any, b:any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).map((order: any) => (
                    <Card key={order.id}
                      className={`overflow-hidden shadow-sm hover:shadow-md group relative ${['completed', 'paid', 'cancelled'].includes(order.status) ? 'opacity-80' : 'cursor-pointer'} ${isEditLoadingManual && editingOrderId === order.id ? 'ring-2 ring-primary' : ''}`}
                      onClick={() => {
                        if (['completed', 'paid', 'cancelled'].includes(order.status)) { toast.warn(`Buyurtma (${order.status_display}) tahrirlanmaydi.`); return; }
                        if (isAnyLoading) { toast.info("Amal bajarilmoqda..."); return; }
                        if (editingOrderId === order.id) { setShowHistoryDialog(false); return; }
                        finishEditingInternal(); loadOrderForEditing(order.id);
                      }}>
                      <CardContent className="p-4 grid grid-cols-1 sm:grid-cols-6 md:grid-cols-8 gap-x-4 gap-y-2 text-sm">
                        <div className="sm:col-span-2 md:col-span-2 space-y-0.5"><div className="font-medium">ID: <span className="text-primary font-semibold">{order.id}</span></div><div className="text-muted-foreground text-xs">{formatDateTime(order.created_at)}</div></div>
                        <div className="sm:col-span-2 md:col-span-2 space-y-1 flex flex-col items-start"><Badge variant="outline">{order.order_type_display || order.order_type}</Badge><Badge variant={['completed', 'paid'].includes(order.status) ? 'success' : order.status === 'cancelled' ? 'destructive' : 'secondary'} className="mt-1 capitalize">{order.status_display || order.status}</Badge></div>
                        <div className="sm:col-span-2 md:col-span-2 space-y-0.5">{order.customer_name && <div className="truncate">Mijoz: <span className="font-medium">{order.customer_name}</span></div>}{(order.table_name || order.table?.name) && <div>Stol: <span className="font-medium">{order.table_name || order.table?.name}</span></div>}{order.customer_phone && <div className="text-xs text-muted-foreground">{order.customer_phone}</div>}</div>
                        <div className="sm:col-span-6 md:col-span-2 space-y-1 text-right sm:text-left md:text-right flex flex-col items-end justify-between">
                          <div><div className="font-semibold text-base">{Number(order.final_price || 0).toLocaleString('uz-UZ')} so'm</div><div className="text-muted-foreground text-xs">{(order.items?.reduce((acc:number, curr:any) => acc + curr.quantity, 0) || 0)} ta mahsulot</div></div>
                          {(order.status === 'completed' || order.status === 'paid') && (
                            <Button variant="outline" size="sm" className="mt-2 text-xs h-7 px-2 py-1" onClick={(e) => { e.stopPropagation(); reorderToSameTable(order); }} disabled={isAnyLoading}>
                              {reorderMutation.isPending && reorderMutation.variables?.originalOrderId === order.id ? <Loader2 className="h-3 w-3 mr-1 animate-spin"/> : <Repeat className="h-3 w-3 mr-1" />} Qayta
                            </Button>
                          )}
                        </div>
                      </CardContent>
                      {!['completed', 'paid', 'cancelled'].includes(order.status) && <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100"><Edit className="h-4 w-4 text-muted-foreground"/></div>}
                    </Card>
                  ))}
                </div>}
            </ScrollArea></div>
            <DialogFooter className="px-6 py-3 border-t"><DialogClose asChild><Button variant="outline">Yopish</Button></DialogClose></DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={showCheckoutDialog} onOpenChange={setShowCheckoutDialog}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>To'lov: Stol {tableForCheckout?.name} {tableForCheckout?.zone && tableForCheckout.zone !== 'N/A' ? `(${tableForCheckout.zone})` : ''}</DialogTitle>
                    <DialogDescription>Buyurtma #{tableForCheckout?.active_order_id} | Jami: <span className="font-semibold text-lg ml-1">{parseFloat(tableForCheckout?.active_order_final_price || "0").toLocaleString('uz-UZ')} so'm</span></DialogDescription>
                </DialogHeader>
                <div className="py-4 space-y-4">
                    <Select value={paymentDetails.method} onValueChange={(value) => setPaymentDetails(p => ({ ...p, method: value, received_amount: "" }))}>
                        <SelectTrigger><SelectValue placeholder="To'lov usuli" /></SelectTrigger>
                        <SelectContent><SelectItem value="cash">Naqd</SelectItem><SelectItem value="card">Karta</SelectItem><SelectItem value="mobile">Mobil</SelectItem></SelectContent>
                    </Select>
                    {paymentDetails.method === 'cash' && (
                      <div className="space-y-1">
                        <Label htmlFor="received_amount">Qabul qilingan summa*</Label>
                        <Input id="received_amount" type="number" placeholder="150000" value={paymentDetails.received_amount} onChange={(e) => setPaymentDetails(p => ({ ...p, received_amount: e.target.value }))} min={parseFloat(tableForCheckout?.active_order_final_price || "0")} />
                        {parseFloat(paymentDetails.received_amount) > parseFloat(tableForCheckout?.active_order_final_price || "0") && (
                          <p className="text-xs text-muted-foreground">Qaytim: {(parseFloat(paymentDetails.received_amount) - parseFloat(tableForCheckout?.active_order_final_price || "0")).toLocaleString('uz-UZ')} so'm</p>
                        )}
                      </div>
                    )}
                    {paymentDetails.method === 'mobile' && (
                      <div className="space-y-1">
                        <Label htmlFor="mobile_provider">Mobil Provayder</Label>
                        <Select value={paymentDetails.mobile_provider} onValueChange={(val) => setPaymentDetails(p => ({...p, mobile_provider: val}))}><SelectTrigger id="mobile_provider"><SelectValue/></SelectTrigger>
                           <SelectContent><SelectItem value="Click">Click</SelectItem><SelectItem value="Payme">Payme</SelectItem><SelectItem value="UzPay">UzPay</SelectItem><SelectItem value="Other">Boshqa</SelectItem></SelectContent>
                        </Select>
                      </div>
                    )}
                </div>
                <DialogFooter>
                    <DialogClose asChild><Button variant="outline" disabled={checkoutMutation.isPending}>Bekor</Button></DialogClose>
                    <Button onClick={() => {
                        if (!tableForCheckout || !tableForCheckout.id) { toast.error("Stol topilmadi!"); return; }
                        const payload: any = { method: paymentDetails.method };
                        if (paymentDetails.method === 'cash') { if (!paymentDetails.received_amount || parseFloat(paymentDetails.received_amount) < parseFloat(tableForCheckout?.active_order_final_price || "0")) { toast.error("Qabul qilingan summa xato."); return; } payload.received_amount = parseFloat(paymentDetails.received_amount); }
                        if (paymentDetails.method === 'mobile') { if (!paymentDetails.mobile_provider) {toast.error("Mobil provayder tanlanmagan."); return;} payload.mobile_provider = paymentDetails.mobile_provider; }
                        checkoutMutation.mutate({ tableId: tableForCheckout.id, paymentData: payload });
                    }} disabled={checkoutMutation.isPending || (paymentDetails.method === 'cash' && (!paymentDetails.received_amount || parseFloat(paymentDetails.received_amount) < parseFloat(tableForCheckout?.active_order_final_price || "0")))}>
                        {checkoutMutation.isPending ? <Loader2 className="animate-spin mr-2 h-4 w-4"/> : null} To'lash
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
      </div>
    </TooltipProvider>
  );
}