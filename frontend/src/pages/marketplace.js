import dynamic from "next/dynamic";
const MarketplacePage = dynamic(() => import("@/components/Marketplace/marketPage"), { ssr: false });
export default MarketplacePage;
