<div className="grid md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-6">
  {TIERS.map((tier) => {
    const isAnnual = billingCycle === 'annual';
    const displayPrice = isAnnual ? tier.annualMonthlyPrice : tier.monthlyPrice;
    
    return (
      <motion.div 
        key={tier.key}
        whileHover={{ y: -5 }}
        className={`relative flex flex-col rounded-2xl border ${tier.color} p-6 transition-all`}
      >
        {tier.badge && (
          <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-cyan-500 text-[10px] font-bold text-white uppercase tracking-tighter">
            {tier.badge}
          </div>
        )}

        <div className="mb-6">
          <h3 className="text-xl font-bold text-white">{tier.name}</h3>
          <p className={`text-xs font-mono uppercase tracking-widest ${tier.accentClass}`}>
            {tier.subtitle}
          </p>
        </div>

        <div className="mb-6">
          <div className="flex items-baseline gap-1">
            <span className="text-4xl font-black text-white">${displayPrice}</span>
            <span className="text-white/40 text-sm">/mo</span>
          </div>
          {isAnnual && tier.monthlyPrice > 0 && (
            <p className="text-[10px] text-emerald-400/80 mt-1 font-medium">
              ${displayPrice * 12} billed annually
            </p>
          )}
        </div>

        <ul className="flex-1 space-y-3 mb-8">
          {tier.features.map((feat) => (
            <li key={feat} className="flex items-start gap-2 text-sm text-white/70">
              <span className={`${tier.accentClass} mt-1`}>⚡</span>
              <span>{feat}</span>
            </li>
          ))}
        </ul>

        <button
          onClick={() => handlePayment(tier.key)}
          disabled={loadingTier === tier.key}
          className={`w-full py-3 rounded-xl font-bold transition-all ${
            tier.key === 'observer' 
              ? 'bg-white/10 text-white hover:bg-white/20' 
              : 'bg-white text-black hover:bg-cyan-50'
          }`}
        >
          {loadingTier === tier.key ? 'Processing...' : tier.key === 'observer' ? 'Get Started' : 'Upgrade Now'}
        </button>
        
        {isAnnual && tier.creditHint && (
          <p className="mt-4 text-[10px] text-center text-white/40 italic">
            {tier.creditHint}
          </p>
        )}
      </motion.div>
    );
  })}
</div>