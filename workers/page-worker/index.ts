if (event.type === "GAPS_DETECTED") {
  const pages = event.payload.missing.map((g: string) => ({
    title: `What is ${g}`,
    entity: g,
    sections: {
      definition: `Auto generated definition for ${g}`,
      mechanism: "..."
    }
  }));

  publish(PAGE_GENERATED, pages);
}
