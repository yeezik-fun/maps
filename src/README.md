# Sorgenti

`search-ui.jsx` è la lista dei risultati della ricerca (componente **AnimatedList** di [React Bits](https://reactbits.dev), licenza MIT + Commons Clause).
Viene compilato in `js/search-ui.js` con:

```
esbuild src/search-ui.jsx --bundle --format=esm --jsx=transform --jsx-factory=React.createElement --jsx-fragment=React.Fragment \
  --external:react --external:react-dom/client --external:lucide-react --external:lucide --target=es2020 --outfile=js/search-ui.js
```

React e le icone Lucide arrivano da esm.sh tramite la import map in `index.html`.
