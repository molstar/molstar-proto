/**
 * Copyright (c) 2018 mol* contributors, licensed under MIT, See LICENSE file for more info.
 *
 * @author Paul Luna <paulluna0215@gmail.com>
 */
import PointComponent from './point-component';

import * as React from 'react';
import { Vec2 } from 'mol-math/linear-algebra';

interface LineGraphComponentState {[x:string]:any,
    points: Vec2[],
    copyPoint: any,
    canSelectMultiple: boolean,
    x: string | number,
    y: string | number,
    selected: number[]
}

export default class LineGraphComponent extends React.Component<any, LineGraphComponentState> {
    private myRef:any;
    private height: number;
    private width: number;
    private padding: number;
    private updatedX: number;
    private updatedY: number;
    private ghostPoints: {id: number, element: SVGElement}[];
    // private xValues: number[];
    // private yValues: number[]
    private gElement: SVGElement;
    private namespace: string;
    private userInput: {[name:string]: number} = {};
    private mouseStartPoint: Vec2;
    private mouseDown: boolean;
    private hasDragged: boolean;
    

    constructor(props: any) {
        super(props);
        this.myRef = React.createRef();
        this.state = {
            points:[
                Vec2.create(0, 0),
                Vec2.create(1, 0)
            ],
            copyPoint: undefined,
            selected: [],
            canSelectMultiple: false,
            x: '',
            y: ''
        };
        this.height = 400;
        this.width = 600;
        this.padding = 70;

        this.ghostPoints = [];
        // this.xValues = [];
        // this.yValues = [];
        this.namespace = 'http://www.w3.org/2000/svg';
        this.userInput['x'] = -1;
        this.userInput['y'] = -1;
        this.mouseDown = false;
        this.hasDragged = false;        
    
        for (const point of this.props.data){
            this.state.points.push(point);
        }
        
        this.state.points.sort((a, b) => { 
            if(a[0] === b[0]){
                if(a[0] === 0){
                    return a[1]-b[1];
                }
                if(a[1] === 1){
                    return b[1]-a[1];
                }
                return a[1]-b[1];
            }
            return a[0] - b[0];
        });

        this.handleDrag = this.handleDrag.bind(this);
        this.handleMultipleDrag = this.handleMultipleDrag.bind(this);
        this.handleDoubleClick = this.handleDoubleClick.bind(this);
        this.refCallBack = this.refCallBack.bind(this);
        this.change = this.change.bind(this);
        this.handleKeyUp = this.handleKeyUp.bind(this);
        this.handleLeave = this.handleLeave.bind(this);
        this.handleEnter = this.handleEnter.bind(this);
        this.handleChange = this.handleChange.bind(this);
        this.addPoint = this.addPoint.bind(this);
        this.handleSubmit = this.handleSubmit.bind(this);
        this.handleCanvasClick = this.handleCanvasClick.bind(this); 
    }

    public render() {
        const points = this.renderPoints();
        const lines = this.renderLines();
        
        return ([
            <div key="LineGraph">                
                <svg
                    className="msp-canvas"
                    ref={this.refCallBack} 
                    viewBox={`0 0 ${this.width+this.padding} ${this.height+this.padding}`}
                    onMouseMove={this.state.canSelectMultiple? this.handleMultipleDrag : this.handleDrag} 
                    onClick={this.handleCanvasClick}
                    onMouseUp={this.handlePointUpdate}
                    onMouseLeave={this.handleLeave}
                    onMouseEnter={this.handleEnter}
                    tabIndex={0}
                    onKeyDown={this.handleKeyDown}
                    onKeyUp={this.handleKeyUp}
                    onDoubleClick={this.handleDoubleClick}>  
            
                    <g stroke="black" fill="black">
                        {lines}
                        {points}
                    </g>
                    <g className="ghost-points" stroke="black" fill="black">
                    </g>
                </svg>
            </div>,
            <div key="line-graph-controls" className="line-graph-controls">
                <ul style={{ margin: "5px 50px", listStyle: "none"}}>
                    <li style={{display: "inline"}}><div title="Delete point" className="icon disabled-minus" onClick={this.deletePoint(this.state.selected[0])}></div></li>
                    <li style={{display: "inline"}}><div title="Add point" className="icon disabled-plus" onClick={this.handleSubmit}></div></li>
                    <li style={{marginLeft: "5px", display: "inline-block"}}><input min="0" max="1" step="0.1" type="number" placeholder="x" name="x" value={this.state.x} onChange={this.handleChange} required/></li>
                    <li style={{marginLeft: "5px", display: "inline-block"}}><input min="0" max="1" step="0.1" type="number" placeholder="y" name="y" value={this.state.y} onChange={this.handleChange} required/></li>
                </ul>
            </div>
        ]);
    }

    componentDidMount() {
        this.gElement = document.getElementsByClassName('ghost-points')[0] as SVGElement;
    }

    private change(points: Vec2[]){
        let copyPoints = points.slice();
        copyPoints.shift();
        copyPoints.pop();
        this.props.onChange(copyPoints);    
    }

    private handleKeyDown = (event: any) => {
        if(event.keyCode == 91) {
            let elements = document.getElementsByClassName('icon');
            elements[0].classList.remove('icon-minus');
            elements[0].classList.add('disabled-minus');
            this.setState({canSelectMultiple: true});
        }
    }

    private handleKeyUp = (event: any) => {
        this.ghostPoints = [];
        this.gElement.innerHTML = '';
        this.setState({canSelectMultiple: false});
    }

    private handleCanvasClick() {
        console.log(`handleCanvasClick()`);
        if(this.state.canSelectMultiple) {
            return;
        }

        const elements = document.getElementsByClassName('icon');
        this.gElement.innerHTML = '';
        this.setState({selected: []});
        this.ghostPoints = [];
        elements[0].classList.remove('icon-minus');
        elements[0].classList.add('disabled-minus');
        elements[1].classList.remove('icon-plus');
        elements[1].classList.add('disabled-plus');
    }

    private handlePointClick = (event:any) => {
        event.stopPropagation();

        let selected;
        const id = parseInt(event.target.id);
        const point = Vec2.create(this.state.points[id][0], this.state.points[id][1]);
        const copyPoint: Vec2 = this.normalizePoint(point);

        if(this.state.canSelectMultiple) {
            this.ghostPoints.push({id: id, element: document.createElementNS(this.namespace, 'circle') as SVGElement});
            let size = this.ghostPoints.length;
            this.ghostPoints[size-1].element.setAttribute('r', '10');
            this.ghostPoints[size-1].element.setAttribute('fill', 'orange');
            this.ghostPoints[size-1].element.setAttribute('cx', `${copyPoint[0]}`);
            this.ghostPoints[size-1].element.setAttribute('cy', `${copyPoint[1]}`);
            this.ghostPoints[size-1].element.addEventListener('mousedown', this.handleMouseDown); 
            this.gElement.appendChild(this.ghostPoints[size-1].element);
            // this.xValues.push(copyPoint[0]);
            // this.xValues.sort((a,b) =>  {return a-b});
            // this.yValues.push(copyPoint[1]);
            // this.yValues.sort((a,b) => {return a-b});
            selected = this.state.selected;
            selected.push(id);
            this.setState({selected: selected});
            return;
        } 
        
        let elements = document.getElementsByClassName('icon');
        elements[0].classList.remove('disabled-minus');
        elements[0].classList.add('icon-minus');
        this.ghostPoints[0].element.setAttribute('style', 'display: visible');
        this.ghostPoints[0].element.addEventListener('mousedown', this.handleMouseDown); 

    }

    private handleMouseDown = (event: any) => {
        const id = parseInt(event.target.id);
        const x = event.target.cx.animVal.value;
        const y = event.target.cy.animVal.value;

        if(id === 0 || id === this.state.points.length-1){
            return;
        }

        this.mouseDown = true;

        if (this.state.canSelectMultiple) {
            this.mouseStartPoint = Vec2.create(x, y); // getting the last time the user held down the mouse as a tempStarting point
            return;
        }
        if(isNaN(id)) {
            return;
        }

        let elements = document.getElementsByClassName('icon');
        const copyPoint: Vec2 = Vec2.create(x, y);
        elements[0].classList.remove('icon-minus');
        elements[0].classList.add('disabled-minus');
        this.ghostPoints = [];
        this.gElement.innerHTML = '';
        this.ghostPoints.push({id: id, element: document.createElementNS(this.namespace, 'circle') as SVGElement});
        this.ghostPoints[0].element.setAttribute('r', '10');
        this.ghostPoints[0].element.setAttribute('fill', 'orange');
        this.ghostPoints[0].element.setAttribute('cx', `${copyPoint[0]}`);
        this.ghostPoints[0].element.setAttribute('cy', `${copyPoint[1]}`);
        this.ghostPoints[0].element.setAttribute('style', 'display: none');
        this.gElement.appendChild(this.ghostPoints[0].element);
        this.updatedX = copyPoint[0];
        this.updatedY = copyPoint[1];
        this.setState({selected: [id]})
    }


    private handleDrag(event: any) {
        if(this.state.selected.length === 0 || !this.mouseDown){
            return
        }

        let updatedCopyPoint;
        let svgP;
        const pt = this.myRef.createSVGPoint();
        const padding = this.padding/2;
        const elements = document.getElementsByClassName('icon');
        elements[0].classList.remove('icon-minus');
        elements[0].classList.add('disabled-minus');
        pt.x = event.clientX;
        pt.y = event.clientY;
        svgP = pt.matrixTransform(this.myRef.getScreenCTM().inverse());
        
        if ((svgP.x < (padding) || svgP.x > (this.width+(padding))) && (svgP.y > (this.height+(padding)) || svgP.y < (padding))) {
            updatedCopyPoint = Vec2.create(this.updatedX, this.updatedY);
        }
        else if (svgP.x < padding) {
            updatedCopyPoint = Vec2.create(padding, svgP.y);
        }
        else if( svgP.x > (this.width+(padding))) {
            updatedCopyPoint = Vec2.create(this.width+padding, svgP.y);
        }
        else if (svgP.y > (this.height+(padding))) {
            updatedCopyPoint = Vec2.create(svgP.x, this.height+padding);
        }
        else if (svgP.y < (padding)) {
            updatedCopyPoint = Vec2.create(svgP.x, padding);
        } else {
            updatedCopyPoint = Vec2.create(svgP.x, svgP.y);
        }
        this.updatedX = updatedCopyPoint[0];
        this.updatedY = updatedCopyPoint[1];
        const unNormalizePoint = this.unNormalizePoint(updatedCopyPoint);
        this.ghostPoints[0].element.setAttribute('style', 'display: visible');
        this.ghostPoints[0].element.setAttribute('cx', `${updatedCopyPoint[0]}`);
        this.ghostPoints[0].element.setAttribute('cy', `${updatedCopyPoint[1]}`);
        this.props.onDrag(unNormalizePoint);
        this.hasDragged = true;
    }

    private handleMultipleDrag(event: any) {
        if(!this.mouseDown) {
            return;
        }

        const pt = this.myRef.createSVGPoint(); // create a temp point for the cursor pointer
        let updatedGhostPoint: Vec2;
        let ghostPoint: Vec2;
        // let updatePoints = [];
        // const padding = this.padding/2;
        pt.x = event.clientX;   // get x value of pointer
        pt.y = event.clientY;   // get y value of pointer
        const svgP = pt.matrixTransform(this.myRef.getScreenCTM().inverse());
        const directionalVector = Vec2.create(svgP.x-this.mouseStartPoint[0], svgP.y-this.mouseStartPoint[1]); 

        for(let i = 0; i < this.ghostPoints.length; i++) {
            const x = this.ghostPoints[i].element.getAttribute('cx');
            const y = this.ghostPoints[i].element.getAttribute('cy');
            ghostPoint = Vec2.create(parseInt(x as string), parseInt(y as string));
            updatedGhostPoint = Vec2.create(ghostPoint[0]+directionalVector[0], ghostPoint[1]+directionalVector[1]);
            this.ghostPoints[i].element.setAttribute('cx', `${updatedGhostPoint[0]}`);
            this.ghostPoints[i].element.setAttribute('cy', `${updatedGhostPoint[1]}`);
        }
        this.mouseStartPoint = Vec2.create(svgP.x, svgP.y);
        this.hasDragged = true;
    }

    private handlePointUpdate = (event: any) => {
        const selected = this.state.selected;
        this.mouseDown = false;
        if ((this.state.canSelectMultiple && !this.hasDragged) || !this.hasDragged) { 
            return; 
        }
        if(selected.length === 0 || selected[0] === 0 || selected[selected.length-1] === this.state.points.length-1) {
            this.setState({
                copyPoint: undefined,
            });
            return;
        }
        let points = this.state.points;
        for(let i = 0; i < this.ghostPoints.length; i++) {
            const id = this.ghostPoints[i].id;
            const element = this.ghostPoints[i].element;
            const x = parseInt(element.getAttribute('cx') as string);
            const y = parseInt(element.getAttribute('cy') as string);
            const updatedPoint = this.unNormalizePoint(Vec2.create(x, y));
            points[id] = updatedPoint;
        }

        // const updatedPoint = this.unNormalizePoint(Vec2.create(this.updatedX, this.updatedY));
        // const points = this.state.points.filter((_,i) => i !== selected[0]);
        // points.push(updatedPoint);;
        points.sort((a, b) => { 
            if(a[0] === b[0]){
                if(a[0] === 1){
                    return b[1]-a[1];
                }
                return a[1]-b[1];
            }
            return a[0] - b[0];
        });
        this.setState({
            points,
            selected: [],
        });
        this.change(points);
        this.gElement.innerHTML = '';
        this.ghostPoints.forEach(x => {
            x.element.removeEventListener('mousedown', this.handleMouseDown);
        });
        this.ghostPoints = [];
        this.hasDragged = false;
        document.removeEventListener("mousemove", this.handleDrag, true);
        document.removeEventListener("mouseup", this.handlePointUpdate, true);
    }

    private handleChange(event: any) {
        this.setState({[event.target.name]: event.target.value});
        this.userInput[event.target.name] = event.target.value;
        if(event.target.value === '') { this.userInput[event.target.name] =-1; }
        let elements = document.getElementsByClassName('icon');
        if(this.userInput['x'] > -1 && this.userInput['y'] > -1) {
            elements[1].classList.remove('disabled-plus');
            elements[1].classList.add('icon-plus');
        } else {
            elements[1].classList.remove('icon-plus');
            elements[1].classList.add('disabled-plus');
            elements[1].removeEventListener('click', this.handleSubmit, true);
        }
    }

    private handleDoubleClick(event: any) {
        let newPoint;
        const pt = this.myRef.createSVGPoint();
        pt.x = event.clientX;
        pt.y = event.clientY;
        const svgP = pt.matrixTransform(this.myRef.getScreenCTM().inverse());
        const padding = this.padding/2; 
        if( svgP.x < (padding) || 
            svgP.x > (this.width+(padding)) || 
            svgP.y > (this.height+(padding)) || 
            svgP.y < (this.padding/2)) {
            return;
        }
        newPoint = this.unNormalizePoint(Vec2.create(svgP.x, svgP.y));
        this.addPoint(newPoint);
    }

    private handleSubmit() {
        const x = parseFloat(this.state.x as string);
        const y = parseFloat(this.state.y as string); 
        const point = Vec2.create(x, y);
        let elements = document.getElementsByClassName('icon');
        elements[0].classList.remove('icon-minu');
        elements[0].classList.add('disabled-minus');
        elements[1].classList.remove('icon-plus');
        elements[1].classList.add('disabled-plus');
        this.userInput['x'] = -1;
        this.userInput['y'] = -1;
        this.setState({
            x: '',
            y: '',
        })
        this.addPoint(point);
    }

    private addPoint(point: Vec2) {
        const points = this.state.points;
        points.push(point);
        points.sort((a, b) => { 
            if(a[0] === b[0]){
                if(a[0] === 0){
                    return a[1]-b[1];
                }
                if(a[1] === 1){
                    return b[1]-a[1];
                }
                return a[1]-b[1];
            }
            return a[0] - b[0];
        });

        this.change(points);
        this.setState({points});
    }

    private deletePoint = (i:number) => (event: any) => {
        if(i===0 || i===this.state.points.length-1){ return; }
        const points = this.state.points.filter((_,j) => j !== i);
        points.sort((a, b) => { 
            if(a[0] === b[0]){
                if(a[0] === 0){
                    return a[1]-b[1];
                }
                if(a[1] === 1){
                    return b[1]-a[1];
                }
                return a[1]-b[1];
            }
            return a[0] - b[0];
        });
         const elements = document.getElementsByClassName('icon');
        elements[0].classList.remove('icon-minus');
        elements[0].classList.add('disabled-minus');
        elements[0].setAttribute('onClick', '');
        this.gElement.innerHTML = '';
        this.setState({points});
        this.change(points);
        event.stopPropagation();
    }

    private handleLeave() {
        if(this.state.selected.length === 0) {
            return;
        }

        document.addEventListener('mousemove', this.handleDrag, true);
        document.addEventListener('mouseup', this.handlePointUpdate, true);
    }

    private handleEnter() {
        document.removeEventListener('mousemove', this.handleDrag, true);
        document.removeEventListener('mouseup', this.handlePointUpdate, true);
    }

    private normalizePoint(point: Vec2) {
        const min = this.padding/2;
        const maxX = this.width+min;
        const maxY = this.height+min; 
        const normalizedX = (point[0]*(maxX-min))+min; 
        const normalizedY = (point[1]*(maxY-min))+min;
        const reverseY = (this.height+this.padding)-normalizedY;
        const newPoint = Vec2.create(normalizedX, reverseY);
        return newPoint;
    }

    private unNormalizePoint(point: Vec2) {
        const min = this.padding/2;
        const maxX = this.width+min; 
        const maxY = this.height+min;
        const unNormalizedX = (point[0]-min)/(maxX-min);

        // we have to take into account that we reversed y when we first normalized it.
        const unNormalizedY = ((this.height+this.padding)-point[1]-min)/(maxY-min); 

        return Vec2.create(unNormalizedX, unNormalizedY);
    }

    private refCallBack(element: any) {
        if(element){
            this.myRef = element;
        }
    }

    private renderPoints() {
        const points: any[] = [];
        let point: Vec2;
        for (let i = 0; i < this.state.points.length; i++){
            if(i != 0 && i != this.state.points.length-1){
                point = this.normalizePoint(this.state.points[i]);
                points.push(<PointComponent
                        key={i}
                        id={i}
                        x={point[0]} 
                        y={point[1]}
                        nX={this.state.points[i][0]}
                        nY={this.state.points[i][1]}
                        selected={false}
                        onmouseover={this.props.onHover}
                        onmousedown={this.handleMouseDown}
                        onclick={this.handlePointClick}
                    />);
            }
        }
        return points;
    }

    private renderLines() {
        const points: Vec2[] = [];
        let lines = [];
        let min:number;
        let maxX:number;
        let maxY: number;
        let normalizedX: number;
        let normalizedY: number;
        let reverseY: number;

        for(const point of this.state.points){
            min = this.padding/2;
            maxX = this.width+min;
            maxY = this.height+min; 
            normalizedX = (point[0]*(maxX-min))+min; 
            normalizedY = (point[1]*(maxY-min))+min;
            reverseY = this.height+this.padding-normalizedY;
            points.push(Vec2.create(normalizedX, reverseY));
        }

        const data = points;
        const size = data.length;

        for (let i=0; i<size-1;i++){
            const x1 = data[i][0];
            const y1 = data[i][1];
            const x2 = data[i+1][0];
            const y2 = data[i+1][1];
            
            lines.push(<line key={`lineOf${i}`} x1={x1} x2={x2} y1={y1} y2={y2} stroke="#cec9ba" strokeWidth="5"/>)
        }
        
        return lines;
    }
}