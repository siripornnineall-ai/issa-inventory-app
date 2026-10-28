import { redirect } from "next/navigation";

// หน้ายอดขายรายเดือนย้ายไปเป็นแท็บ "ยอดขาย" ในสต็อกภาพรวมแล้ว (ลิงก์เก่ายังใช้ได้)
export default function StockOutOverviewRedirect() {
  redirect("/stock-overview?tab=sales");
}
