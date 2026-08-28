    /* Production preflight: satisfy optional legacy bindings without rewriting source. */
    (() => {
      const ensureOptionalControl = (id) => {
        if (document.getElementById(id)) return;
        const button = document.createElement('button');
        button.id = id;
        button.type = 'button';
        button.hidden = true;
        button.setAttribute('aria-hidden', 'true');
        document.body.appendChild(button);
      };
      ensureOptionalControl('studentLabLauncher');
    })();
