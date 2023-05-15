import fs from 'fs';

export const Cache = {
  Cchs: { Fls: {}, Dt: {} }, // caches, files, data.
  IsRolling: false,
  /*
    @ file path.
    @ callback (error code, result data). */
  FileLoad (FlPth, Clbck) {
    const This = this;

    if (this.Cchs.Fls[FlPth]) {
      const { Dt = null, Str = '' } = this.Cchs.Fls[FlPth];

      if (!Dt || !Str) { return Clbck(-1); }

      return Clbck(1, Str, Dt);
    }

    fs.readFile(
      FlPth,
      'utf8',
      function (Err, FlStr) { // error, file string.
        if (Err) { return Clbck(-2); }

        const Dt = (new Date()).getTime();

        This.Cchs.Fls[FlPth] = { Dt, Str: FlStr };

        Clbck(0, FlStr, Dt);
      });
  },
  /*
    @ key name.
    < true | false. */
  IsFileCached (Ky) {
    let FlInfo = this.Cchs.Fls && this.Cchs.Fls[Ky] || null;

    if (!FlInfo || !FlInfo.Dt || !FlInfo.Str) { return false; }

    return true;
  },
  Has (Ky) {
    return this.Cchs.Dt[Ky] ? true : false;
  },
  /* get the value.
    @ key name.
    < cached data, or null. */
  Get (Ky) {
    if (!this.Cchs.Dt[Ky] || !this.Cchs.Dt[Ky]['Vl'] || !this.Cchs.Dt[Ky]['Dt'] || !this.Cchs.Dt[Ky]['ScndLmt']) {
      return null;
    }

    let Drtn = ((new Date()).getTime() - this.Cchs.Dt[Ky]['Dt']) / 1000; // duration.

    return Drtn > this.Cchs.Dt[Ky]['ScndLmt'] ? null : this.Cchs.Dt[Ky]['Vl'];
  },
  /* set the value.
    @ key name.
    @ value.
    @ second limit, default 300 seconds.
    < return true or false. */
  Set (Ky, Vl, ScndLmt = 300) {
    if (typeof Ky !== 'string' || typeof ScndLmt !== 'number') { return false; }

    this.Cchs.Dt[Ky] = { Vl: Vl, Dt: (new Date()).getTime(), ScndLmt: ScndLmt };

    return true;
  },
  Recycle () {
    const NwTm = (new Date()).getTime(); // now time.
    let Kys = Object.keys(this.Cchs.Dt); // keys.

    for (let i = 0; i < Kys.length; i++) {
      let Tgt = this.Cchs.Dt[Kys[i]]; // target.

      if (!Tgt || !Tgt.Vl || !Tgt.Dt || !Tgt.ScndLmt) {
        delete this.Cchs.Dt[Kys[i]];
        continue;
      }

      let Drtn = (NwTm - Tgt.Dt) / 1000; // duration.

      if (Drtn > Tgt.ScndLmt) { delete this.Cchs.Dt[Kys[i]]; }
    }
  },
  /*
    @ minute to trigger recycling. */
  RecycleRoll (Mnt) {
    if (this.IsRolling) { return; }

    this.IsRolling = true;

    if (!Mnt || typeof Mnt !== 'number' || Mnt < 1) { Mnt = 1; }

    const MlScnd = Mnt * 60 * 1000; // millisecond.

    setInterval(this.Recycle.bind(this), MlScnd);
  }
};

export default Cache;
