import React from 'react';
import Plot from 'react-plotly.js';

function Barplot({ interactiveData, customTitle, xAxisTitle, yAxisTitle }) {
  if (!interactiveData?.values?.length) return <span>No barplot data available</span>;

  const layoutProps = { width: Math.min(1200, window.innerWidth - 40), margin: { l: 120, r: 50, t: 100, b: 120 }, annotations: [] };

  const data = interactiveData.species.map((species, i) => ({
    x: interactiveData.samples,
    y: interactiveData.values.map(row => row[i]),
    type: 'bar',
    name: species,
    showlegend: true,
  }));

  return (
    <Plot
      id="barplot-plot"
      data={data}
      layout={{
        ...layoutProps,
        barmode: 'stack',
        showlegend: true,
        title: { text: customTitle || undefined, font: { size: 18 } },
        xaxis: { title: { text: xAxisTitle || '', font: { size: 16 } }, automargin: true },
        yaxis: { title: { text: yAxisTitle || '', font: { size: 16 } }, automargin: true },
        height: 500,
      }}
      config={{ responsive: true }}
    />
  );
}

export default Barplot;
