import api from "./api.ts";

export const paymentService = {
  createStripeCheckout: async (tier) => {
    const response = await api.post("/payment/stripe", { tier });
    return response.data.data;
  },

  createCryptoOrder: async (tier) => {
    const response = await api.post("/payment/crypto", { tier });
    return response.data.data;
  }
};
