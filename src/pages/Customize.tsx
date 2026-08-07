import { useMemo, useState } from "react";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import Donut from "../components/Donut";
import CakeCanvas, { type DraggableItem } from "../customize/CakeCanvas";
import OptionPalette from "../customize/OptionPalette";
import SizePicker from "../customize/SizePicker";
import OrderSummary from "../customize/OrderSummary";
import { flavors, fillings, decorations, sizes, MAX_DECORATIONS } from "../customize/data";
import "./Customize.css";

export default function Customize() {
  const [flavorId, setFlavorId] = useState(flavors[0].id);
  const [fillingId, setFillingId] = useState<string | null>(null);
  const [sizeId, setSizeId] = useState(sizes[1].id);
  const [decorationIds, setDecorationIds] = useState<string[]>([]);
  const [placed, setPlaced] = useState(false);

  const flavor = useMemo(() => flavors.find((f) => f.id === flavorId)!, [flavorId]);
  const filling = useMemo(() => fillings.find((f) => f.id === fillingId) ?? null, [fillingId]);
  const size = useMemo(() => sizes.find((s) => s.id === sizeId)!, [sizeId]);
  const decorationList = useMemo(
    () => decorationIds.map((id) => decorations.find((d) => d.id === id)!).filter(Boolean),
    [decorationIds]
  );

  const handleItem = (item: DraggableItem) => {
    setPlaced(false);
    if (item.kind === "flavor") setFlavorId(item.id);
    if (item.kind === "filling") setFillingId(item.id);
    if (item.kind === "decoration") {
      setDecorationIds((prev) =>
        prev.length >= MAX_DECORATIONS ? prev : [...prev, item.id]
      );
    }
  };

  const removeDecoration = (index: number) => {
    setDecorationIds((prev) => prev.filter((_, i) => i !== index));
  };

  return (
    <>
      <Navbar />
      <main className="customize-page">
        <header className="customize-hero">
          <Donut className="customize-hero__donut" size={54} rotate={-14} />
          <div className="container">
            <span className="section-eyebrow">Cake Designer</span>
            <h1>Build your dream cake</h1>
            <p>Drag flavors, fillings, and decorations onto the cake — or just tap to add them.</p>
          </div>
        </header>

        <div className="container customize-layout">
          <div className="customize-panel">
            <OptionPalette
              title="1. Choose a Flavor"
              hint="drag or tap"
              options={flavors}
              selectedId={flavorId}
              onSelect={handleItem}
            />
            <OptionPalette
              title="2. Choose a Filling"
              hint="drag or tap"
              options={fillings}
              selectedId={fillingId}
              onSelect={handleItem}
            />
            <OptionPalette
              title="3. Add Decorations"
              hint={`drag or tap · up to ${MAX_DECORATIONS}`}
              options={decorations}
              onSelect={handleItem}
              countFor={(id) => decorationIds.filter((d) => d === id).length}
            />
            <SizePicker sizes={sizes} selectedId={sizeId} onSelect={setSizeId} />
          </div>

          <div className="customize-stage">
            <CakeCanvas
              flavor={flavor}
              filling={filling}
              size={size}
              decorationIds={decorationIds}
              onDropItem={handleItem}
              onRemoveDecoration={removeDecoration}
            />
          </div>

          <div className="customize-summary">
            <OrderSummary
              flavor={flavor}
              filling={filling}
              size={size}
              decorationList={decorationList}
              placed={placed}
              onPlaceOrder={() => setPlaced(true)}
            />
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
