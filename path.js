import L from 'leaflet';

export default {
   data() {
      return {
         pathSim: [],
         dashed: [],
         colors: [],
         pathSimParsed: [],
         pathSimDashed: [],
         poly: '',
         polyVar: ''
      }
   },
   watch: {
      pathSimParsed() {
         if (this.pathSimParsed.length !== 0) {
            const map = this.$refs.nmsMap.mapObject;
            map.on('click', e => {
               if (!this.markerClicked) {
                  this.findClosestPoint(e.latlng);
               } 
            })
            map.on('popupclose', e => {
               this.markerClicked = false;
            })
         }
      }
   },
   methods: {
      findClosestPoint(e) {
         // console.log(this)
         var vm = this;
         // console.log(vm)
         const map = vm.$refs.nmsMap.mapObject;
         var poly = vm.$refs.polyLine.latLngs

         var closestPoint = L.GeometryUtil.closest(map, poly, e, true);
         closestPoint = [closestPoint.lat, closestPoint.lng];

         var found = vm.pathSim.find(item => {
            if (item[1][0] === closestPoint[0] && item[1][1] === closestPoint[1]) {
               return item
            }
         })
         // console.log(this.pathSim)
         // console.log(closestPoint)

         var timePopup = L.popup().setLatLng(found[1]).setContent(`
         <p>Time: ${this.$func.printUnixTimestamp(found[0])}<p>
         <p>Lat: ${this.positionFormatter(found[1][0], 'N ', 'S ')}</p>
         <p>Lon: ${this.positionFormatter(found[1][1], 'E ', 'W ')}</p>`).openOn(map);

      },
      parsePath(toExtract) {
         var vm = this;
         var extracted = [];
         if (toExtract)
         extracted = toExtract.map((point) => {
            return point[1]
         })
         var forSlice = extracted;
         var indexes = [];
         do {
            let index = forSlice.findIndex(nullCheck);
            forSlice[index] = ['todelete']
            indexes.push(index);
         } while (forSlice.findIndex(nullCheck) !== -1)
         
         function nullCheck(arr) {
            if (arr[0] === null || arr[1] === null) {
               return true
            }
         }
         
         var groups = [];
         if (indexes[0] !== 0) {
            groups.push(forSlice.slice(0, indexes[0]))
         }
         for (var i = 0; i < indexes.length; i++) {
            let checkResult = forSlice.slice(indexes[i], indexes[i + 1])
            checkResult.shift();
            if (checkResult.length === 1) {
               let newArr = checkResult[0];
               checkResult.push([newArr[0] + 0.01, newArr[1] + 0.01])
               groups.push(checkResult);
            } else if (checkResult.length !== 0) {
               groups.push(checkResult);
            }
         }
         this.pathSimParsed = groups;
         this.fillGaps(groups);

         return groups
      },
      fillGaps(groups) {
         var vm = this;
         var dashedArr = [];
         for (var i = 0; i < groups.length - 1; i++) {
            let lngArr = [];
            let first = groups[i];
            let second = groups[i + 1];
            let lastOfFirst = first[first.length - 1];
            let firstOfSecond = second[0];
            lngArr = [lastOfFirst, firstOfSecond];
            dashedArr.push(lngArr);
         }
         vm.pathSimDashed = dashedArr
      },
   },
}