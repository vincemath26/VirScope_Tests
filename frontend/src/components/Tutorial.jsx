import React from 'react';

function Tutorial() {
  return (
    <div style={{ padding: '20px', lineHeight: '1.6' }}>
      <h2>Welcome to the VirScope Tutorial</h2>
      <p>
        This tutorial will guide you through how to work with your workspace. Your workspace is essentially
        a main hub for a particular project that you may have in mind. There are three mains tabs for each
        VirScope workspace: 
      </p>
      <ul>
        <li><strong>Tutorial:</strong> This startup tab in which details instructions on how to navigate through your workspace!</li>
        <li><strong>Datasets:</strong> Upload your datasets and optionally combine any associated metadata with it.</li>
        <li><strong>Graphs:</strong> Explore interactive visualisations of your data.</li>
      </ul>
      <p>
        Future updates will include step-by-step guidance for your analyses. For now, feel free to explore your workspace tabs.
      </p>
    </div>
  );
}

export default Tutorial;
