"use strict";
Component({
    properties: {
        seats: { type: Array, value: [] },
        canAddAi: { type: Boolean, value: false },
    },
    methods: {
        onAddAi(event) {
            this.triggerEvent('addAi', { seatIndex: Number(event.currentTarget.dataset.index) });
        },
    },
});
