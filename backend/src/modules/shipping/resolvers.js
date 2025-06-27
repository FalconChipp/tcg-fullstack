import { ShippingLabel } from '../../models/index.js';
import { verifyJwt } from '../auth/helpers.js';
import { createShipment, buyShipment, refundShipment } from './easypost.js';
import { calculateTotalCost } from './utils.js';

const API_FEE = 0.05; // $0.05 per label charged by EasyPost

const resolvers = {
  Query: {
    shippingRates: async (_, { to, from, parcel }, { token }) => {
      verifyJwt(token); // require auth
      const shipment = await createShipment(to, from, parcel);
      return shipment.rates || [];
    },
    shippingLabel: async (_, { id }, { token }) => {
      const payload = verifyJwt(token);
      const label = await ShippingLabel.findByPk(id);
      if (!label || label.userId !== payload.id) return null;
      return label;
    },
  },
  Mutation: {
    createShippingLabel: async (_, { to, from, parcel, rateId, relatedType, relatedId }, { token }) => {
      const payload = verifyJwt(token);
      const shipment = await createShipment(to, from, parcel);
      const bought = await buyShipment(shipment.id, rateId);
      const rateObj = shipment.rates.find(r => r.id === rateId) || {};
      const label = await ShippingLabel.create({
        userId: payload.id,
        externalLabelId: bought.id,
        trackingNumber: bought.tracking_code,
        carrier: bought.selected_rate?.carrier,
        serviceLevel: bought.selected_rate?.service,
        rate: parseFloat(rateObj.rate || 0),
        labelUrl: bought.postage_label?.label_url,
        status: bought.status,
        cost: calculateTotalCost(rateObj.rate),
        apiFee: API_FEE,
        meta: bought,
        relatedType,
        relatedId,
      });
      return label;
    },
    cancelShippingLabel: async (_, { id }, { token }) => {
      const payload = verifyJwt(token);
      const label = await ShippingLabel.findByPk(id);
      if (!label || label.userId !== payload.id) throw new Error('Not found');
      await refundShipment(label.externalLabelId);
      label.refundStatus = 'requested';
      label.refundedAt = new Date();
      await label.save();
      return true;
    },
  },
};

export default resolvers;
