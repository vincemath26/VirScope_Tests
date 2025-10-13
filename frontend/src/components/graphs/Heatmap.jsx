import React from 'react';
import Plot from 'react-plotly.js';

function Heatmap({ interactiveData, customTitle, xAxisTitle, yAxisTitle }) {
  if (!interactiveData?.values?.length) return <span>No heatmap data available</span>;

  const layoutProps = { width: Math.min(1200, window.innerWidth - 40), margin: { l: 120, r: 50, t: 100, b: 120 }, annotations: [] };

  return (
    <Plot
      id="heatmap-plot"
      data={[
        {
          z: interactiveData.values,
          x: interactiveData.samples,
          y: interactiveData.species,
          type: 'heatmap',
          colorscale: 'Magma',
          hoverongaps: false,
          showscale: true,
          colorbar: { title: 'RPK' },
        },
      ]}
      layout={{
        ...layoutProps,
        title: { text: customTitle || undefined, font: { size: 18 } },
        xaxis: { title: { text: xAxisTitle || '', font: { size: 16 } }, automargin: true },
        yaxis: { title: { text: yAxisTitle || '', font: { size: 16 } }, automargin: true },
        height: Math.max(450, interactiveData.species.length * 30),
      }}
      config={{ responsive: true }}
    />
  );
}

export default Heatmap;
