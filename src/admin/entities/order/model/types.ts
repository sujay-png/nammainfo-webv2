export type OrderStatus = "under_review" | "on_work" | "delivered";
export type OrderType = "pro_initial" | "team_addon" | "renewal";
export type DesignMode = "uploaded" | "team_assist";

export interface ShippingAddress {
  fullName?: string;
  phone?: string;
  street?: string;
  city?: string;
  state?: string;
  pincode?: string;
  notes?: string;
}

export interface AdminOrder {
  id: string;
  profileId: string;
  businessName: string;
  ownerName: string;
  email: string | null;
  phone: string | null;
  avatarUrl?: string | null;
  orderType: OrderType;
  cardQuantity: number;
  unitPrice: number;
  totalAmount: number;
  status: OrderStatus;
  designUrl: string | null;
  designMode: DesignMode;
  shippingAddress: ShippingAddress;
  razorpayOrderId: string | null;
  razorpayPaymentId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface OrderStats {
  totalOrders: number;
  underReviewCount: number;
  inProductionCount: number;
  deliveredCount: number;
  totalRevenue: number;
}

export type OrderFilterTab = "all" | "under_review" | "on_work" | "delivered";

export interface OrderFilters {
  search: string;
  tab: OrderFilterTab;
}
