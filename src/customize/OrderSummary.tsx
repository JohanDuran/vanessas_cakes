import type { DecorationOption, FillingOption, FlavorOption, SizeOption } from "./data";
import "./OrderSummary.css";

type Props = {
  flavor: FlavorOption;
  filling: FillingOption | null;
  size: SizeOption;
  decorationList: DecorationOption[];
  onPlaceOrder: () => void;
  placed: boolean;
};

export default function OrderSummary({
  flavor,
  filling,
  size,
  decorationList,
  onPlaceOrder,
  placed,
}: Props) {
  const decorationTotal = decorationList.reduce((sum, d) => sum + d.price, 0);
  const total = size.price + flavor.price + (filling?.price ?? 0) + decorationTotal;

  return (
    <div className="order-summary">
      <h4>Your Order</h4>
      <ul className="order-summary__list">
        <li>
          <span>Size</span>
          <strong>
            {size.name} ({size.diameter}, serves {size.serves})
          </strong>
        </li>
        <li>
          <span>Flavor</span>
          <strong>{flavor.name}</strong>
        </li>
        <li>
          <span>Filling</span>
          <strong>{filling ? filling.name : "None selected"}</strong>
        </li>
        <li>
          <span>Decorations</span>
          <strong>
            {decorationList.length
              ? decorationList.map((d) => d.emoji).join(" ")
              : "None yet"}
          </strong>
        </li>
      </ul>

      <div className="order-summary__total">
        <span>Estimated Total</span>
        <strong>${total.toFixed(2)}</strong>
      </div>

      <button className="btn btn-primary order-summary__cta" onClick={onPlaceOrder} disabled={!filling}>
        {placed ? "Order Placed! 🎉" : "Place Order"}
      </button>
      {!filling && <p className="order-summary__note">Pick a filling to complete your cake.</p>}
      {placed && (
        <p className="order-summary__success">
          Thanks! Your custom cake request has been sent to our bakers.
        </p>
      )}
    </div>
  );
}
